import { createAudioPipeline } from './audio-pipeline'
import type { AudioSource } from './source-state'

interface SourceRuntime {
  context: AudioContext | null
  stream: MediaStream | null
  processor: { disconnect: () => void } | null
  active: boolean
}

export function createAudioCapture(onMonitorLog?: (level: string, code: string, message: string) => void) {
  const runtime: Record<AudioSource, SourceRuntime> = {
    mic: { context: null, stream: null, processor: null, active: false },
    system: { context: null, stream: null, processor: null, active: false }
  }

  const pipeline = createAudioPipeline({
    sendAudioChunk: (source, buffer) => window.mynai.sttSendAudioChunk(source, buffer),
    addMonitorLog: (level, _code, message) => onMonitorLog?.(level, _code, message)
  })

  async function startMic(): Promise<void> {
    if (runtime.mic.active) return

    const result = await window.mynai.sttStart('mic')
    if (!result.success) throw new Error(result.error ?? 'Failed to start mic transcription.')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
    const context = new AudioContext()
    await context.resume()
    pipeline.resetSourceSampleQueue('mic')
    const processor = await pipeline.buildAudioProcessor(context, stream, 'mic', () => runtime.mic.active)

    runtime.mic = { context, stream, processor, active: true }
  }

  async function stopMic(): Promise<void> {
    if (!runtime.mic.active && !runtime.mic.context) return
    pipeline.drainSourceSampleQueue('mic', { flushPartial: true })
    pipeline.stopAudioResources(runtime.mic.context ?? undefined, runtime.mic.stream ?? undefined, runtime.mic.processor ?? undefined)
    runtime.mic = { context: null, stream: null, processor: null, active: false }
    pipeline.resetChunkCounter('mic')
    await window.mynai.sttStop('mic')
  }

  async function startSystem(): Promise<void> {
    if (runtime.system.active) return

    const sources = await window.mynai.sttGetDesktopSources()
    if (sources.length === 0) throw new Error('No desktop sources found.')

    const result = await window.mynai.sttStart('system')
    if (!result.success) throw new Error(result.error ?? 'Failed to start system-audio transcription.')

    const stream = await pipeline.getSystemAudioStream(sources[0].id)
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack && pipeline.isLikelyCameraTrack(videoTrack.label)) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error(`Desktop capture fell back to a camera source (${videoTrack.label || 'unknown'}).`)
    }
    stream.getVideoTracks().forEach((track) => track.stop())

    const context = new AudioContext()
    await context.resume()
    pipeline.resetSourceSampleQueue('system')
    const processor = await pipeline.buildAudioProcessor(context, stream, 'system', () => runtime.system.active)

    runtime.system = { context, stream, processor, active: true }
  }

  async function stopSystem(): Promise<void> {
    if (!runtime.system.active && !runtime.system.context) return
    pipeline.drainSourceSampleQueue('system', { flushPartial: true })
    pipeline.stopAudioResources(
      runtime.system.context ?? undefined,
      runtime.system.stream ?? undefined,
      runtime.system.processor ?? undefined
    )
    runtime.system = { context: null, stream: null, processor: null, active: false }
    pipeline.resetChunkCounter('system')
    await window.mynai.sttStop('system')
  }

  async function stopAll(): Promise<void> {
    await Promise.all([stopMic(), stopSystem()])
  }

  return { startMic, stopMic, startSystem, stopSystem, stopAll }
}

export type AudioCapture = ReturnType<typeof createAudioCapture>
