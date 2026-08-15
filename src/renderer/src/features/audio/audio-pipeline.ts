import { normalizeSource, type AudioSource } from './source-state'

const TARGET_SAMPLE_RATE = 16000
const TARGET_FRAME_MS = 100
const MIN_FRAME_MS = 50
const TARGET_FRAME_SAMPLES = Math.round((TARGET_SAMPLE_RATE * TARGET_FRAME_MS) / 1000)
const MIN_FRAME_SAMPLES = Math.round((TARGET_SAMPLE_RATE * MIN_FRAME_MS) / 1000)
const WORKLET_MODULE_PATH = '/pcm-capture-worklet.js'

type MonitorLogger = (level: string, code: string, message: string, source?: string, meta?: Record<string, unknown>) => void
type SendAudioChunk = (source: AudioSource, buffer: ArrayBuffer) => void

interface SampleQueue {
  chunks: Float32Array[]
  length: number
}

export function createAudioPipeline({
  sendAudioChunk,
  addMonitorLog
}: {
  sendAudioChunk: SendAudioChunk
  addMonitorLog: MonitorLogger
}) {
  const workletLoadedContexts = new WeakSet<AudioContext>()
  const sourceSampleQueues: Record<AudioSource, SampleQueue> = {
    mic: { chunks: [], length: 0 },
    system: { chunks: [], length: 0 }
  }
  const audioChunkCounters: Record<AudioSource, number> = { mic: 0, system: 0 }

  function convertToPCM16(float32Data: Float32Array): Int16Array {
    const int16Data = new Int16Array(float32Data.length)
    for (let index = 0; index < float32Data.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, float32Data[index]))
      int16Data[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return int16Data
  }

  function downsampleFloat32Buffer(
    input: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number = TARGET_SAMPLE_RATE
  ): Float32Array {
    if (inputSampleRate <= 0 || outputSampleRate <= 0 || input.length === 0) {
      return input
    }

    if (inputSampleRate === outputSampleRate) {
      return input
    }

    const sampleRateRatio = inputSampleRate / outputSampleRate
    const newLength = Math.max(1, Math.round(input.length / sampleRateRatio))
    const result = new Float32Array(newLength)
    let offsetResult = 0
    let offsetInput = 0

    while (offsetResult < result.length) {
      const nextOffsetInput = Math.min(input.length, Math.round((offsetResult + 1) * sampleRateRatio))
      let accum = 0
      let count = 0

      for (let index = offsetInput; index < nextOffsetInput; index += 1) {
        accum += input[index]
        count += 1
      }

      result[offsetResult] = count > 0 ? accum / count : 0
      offsetResult += 1
      offsetInput = nextOffsetInput
    }

    return result
  }

  async function ensureWorkletModule(context: AudioContext): Promise<void> {
    if (workletLoadedContexts.has(context)) {
      return
    }

    await context.audioWorklet.addModule(WORKLET_MODULE_PATH)
    workletLoadedContexts.add(context)
  }

  function isLikelyCameraTrack(trackLabel: string): boolean {
    const label = String(trackLabel || '').toLowerCase()
    return label.includes('camera') || label.includes('webcam')
  }

  async function getSystemAudioStream(sourceId: string): Promise<MediaStream> {
    const mandatoryConstraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      }
    } as unknown as MediaStreamConstraints

    const flatConstraints = {
      audio: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
      video: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId }
    } as unknown as MediaStreamConstraints

    try {
      return await navigator.mediaDevices.getUserMedia(mandatoryConstraints)
    } catch (_mandatoryError) {
      addMonitorLog('info', 'desktop-constraints-fallback', 'Mandatory desktop constraints failed; trying flat syntax', 'system')
      return navigator.mediaDevices.getUserMedia(flatConstraints)
    }
  }

  function resetSourceSampleQueue(source: string): void {
    const resolvedSource = normalizeSource(source)
    sourceSampleQueues[resolvedSource] = { chunks: [], length: 0 }
  }

  function appendSourceSamples(source: string, samples: Float32Array): void {
    if (!samples || samples.length === 0) {
      return
    }

    const resolvedSource = normalizeSource(source)
    sourceSampleQueues[resolvedSource].chunks.push(samples)
    sourceSampleQueues[resolvedSource].length += samples.length
  }

  function pullSourceSamples(source: string, count: number): Float32Array {
    const resolvedSource = normalizeSource(source)
    const queue = sourceSampleQueues[resolvedSource]
    const output = new Float32Array(count)
    let written = 0

    while (written < count && queue.chunks.length > 0) {
      const first = queue.chunks[0]
      const take = Math.min(first.length, count - written)
      output.set(first.subarray(0, take), written)
      written += take

      if (take === first.length) {
        queue.chunks.shift()
      } else {
        queue.chunks[0] = first.subarray(take)
      }

      queue.length -= take
    }

    if (written === count) {
      return output
    }

    return output.subarray(0, written)
  }

  function sendPcmFrame(source: string, floatSamples: Float32Array): void {
    if (!floatSamples || floatSamples.length < MIN_FRAME_SAMPLES) {
      return
    }

    const resolvedSource = normalizeSource(source)
    const pcm = convertToPCM16(floatSamples)
    sendAudioChunk(resolvedSource, pcm.buffer as ArrayBuffer)
    audioChunkCounters[resolvedSource] += 1

    if (audioChunkCounters[resolvedSource] % 50 === 0) {
      addMonitorLog('info', 'chunk-heartbeat', `Chunks sent: ${audioChunkCounters[resolvedSource]}`, resolvedSource, {
        chunks: audioChunkCounters[resolvedSource],
        frameSamples: floatSamples.length
      })
    }
  }

  function drainSourceSampleQueue(source: string, { flushPartial = false }: { flushPartial?: boolean } = {}): void {
    const resolvedSource = normalizeSource(source)
    const queue = sourceSampleQueues[resolvedSource]

    while (queue.length >= TARGET_FRAME_SAMPLES) {
      const frame = pullSourceSamples(resolvedSource, TARGET_FRAME_SAMPLES)
      sendPcmFrame(resolvedSource, frame)
    }

    if (flushPartial && queue.length >= MIN_FRAME_SAMPLES) {
      const tailFrame = pullSourceSamples(resolvedSource, queue.length)
      sendPcmFrame(resolvedSource, tailFrame)
    }
  }

  async function buildAudioProcessor(
    context: AudioContext,
    stream: MediaStream,
    source: string,
    activeCheck: () => boolean
  ) {
    await ensureWorkletModule(context)

    const src = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'pcm-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    })

    const silentGain = context.createGain()
    silentGain.gain.value = 0

    node.port.onmessage = (event: MessageEvent) => {
      if (!activeCheck()) {
        return
      }

      try {
        const chunk = event.data instanceof Float32Array ? event.data : new Float32Array(event.data || [])
        const normalizedChunk = downsampleFloat32Buffer(chunk, context.sampleRate, TARGET_SAMPLE_RATE)
        appendSourceSamples(source, normalizedChunk)
        drainSourceSampleQueue(source)
      } catch (error) {
        addMonitorLog('error', 'audio-process-failed', (error as Error).message || 'Audio processing failed', source)
      }
    }

    src.connect(node)
    node.connect(silentGain)
    silentGain.connect(context.destination)

    return {
      disconnect: () => {
        try {
          node.port.onmessage = null
        } catch (_) {
          // no-op
        }
        try {
          src.disconnect()
        } catch (_) {
          // no-op
        }
        try {
          node.disconnect()
        } catch (_) {
          // no-op
        }
        try {
          silentGain.disconnect()
        } catch (_) {
          // no-op
        }
      }
    }
  }

  function stopAudioResources(
    context: AudioContext | undefined,
    stream: MediaStream | undefined,
    processor: { disconnect: () => void } | undefined
  ): void {
    try {
      processor?.disconnect()
    } catch (_) {
      // no-op
    }

    try {
      context?.close()
    } catch (_) {
      // no-op
    }

    stream?.getTracks().forEach((track) => track.stop())
  }

  function resetChunkCounter(source: string): void {
    audioChunkCounters[normalizeSource(source)] = 0
  }

  return {
    buildAudioProcessor,
    drainSourceSampleQueue,
    getSystemAudioStream,
    isLikelyCameraTrack,
    resetChunkCounter,
    resetSourceSampleQueue,
    stopAudioResources
  }
}
