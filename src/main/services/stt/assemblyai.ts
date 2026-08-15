import WebSocket from 'ws'
import type { WebContents } from 'electron'
import type { SttSource } from '../../../shared/stt-types'

const SAMPLE_RATE = 16000

function normalizeSource(source: string): SttSource {
  return source === 'system' ? 'system' : 'mic'
}

interface SourceState {
  ws: WebSocket | null
  streaming: boolean
}

export function createAssemblyAiSttService(webContents: WebContents) {
  const state: Record<SttSource, SourceState> = {
    mic: { ws: null, streaming: false },
    system: { ws: null, streaming: false }
  }

  function send(channel: string, payload: unknown): void {
    if (!webContents.isDestroyed()) {
      webContents.send(channel, payload)
    }
  }

  function start(source: string, apiKey: string): { success: boolean; error?: string } {
    const resolvedSource = normalizeSource(source)

    if (!apiKey) {
      return { success: false, error: 'AssemblyAI API key not configured. Add it in Settings.' }
    }
    if (state[resolvedSource].streaming) {
      return { success: true }
    }

    const query = new URLSearchParams({
      sample_rate: String(SAMPLE_RATE),
      format_turns: 'true'
    })
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${query.toString()}`, {
      headers: { Authorization: apiKey }
    })
    state[resolvedSource].ws = ws

    ws.on('open', () => {
      state[resolvedSource].streaming = true
      send('stt:status', { source: resolvedSource, status: 'connecting' })
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        switch (msg.type) {
          case 'Begin':
            send('stt:status', { source: resolvedSource, status: 'listening' })
            break
          case 'Turn':
            if (msg.transcript) {
              send(msg.end_of_turn ? 'stt:final' : 'stt:partial', {
                source: resolvedSource,
                text: msg.transcript
              })
            }
            break
          case 'Termination':
            resetSource(resolvedSource)
            send('stt:status', { source: resolvedSource, status: 'off' })
            break
        }
      } catch {
        // ignore malformed frames
      }
    })

    ws.on('error', (error: Error) => {
      send('stt:error', { source: resolvedSource, error: error.message })
      resetSource(resolvedSource)
    })

    ws.on('close', () => {
      if (state[resolvedSource].streaming) {
        resetSource(resolvedSource)
        send('stt:status', { source: resolvedSource, status: 'off' })
      }
    })

    return { success: true }
  }

  function resetSource(source: SttSource): void {
    state[source].ws = null
    state[source].streaming = false
  }

  function stop(source: string): void {
    const resolvedSource = normalizeSource(source)
    const ws = state[resolvedSource].ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'Terminate' }))
      } catch {
        // no-op
      }
    }
    resetSource(resolvedSource)
  }

  function pushAudioChunk(source: string, data: ArrayBuffer): void {
    const resolvedSource = normalizeSource(source)
    const ws = state[resolvedSource].ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(Buffer.from(data))
    }
  }

  function dispose(): void {
    stop('mic')
    stop('system')
  }

  return { start, stop, pushAudioChunk, dispose }
}

export type AssemblyAiSttService = ReturnType<typeof createAssemblyAiSttService>
