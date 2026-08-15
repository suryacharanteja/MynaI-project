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

    // A stale/orphaned socket (e.g. from a rapid stop+start, or a dev-mode
    // double-mount) must be force-closed before opening a new one — otherwise
    // both stay open, audio only reaches whichever is currently referenced, and
    // the other idles until AssemblyAI kills it with a keepalive-timeout close.
    if (state[resolvedSource].ws) {
      try {
        state[resolvedSource].ws!.terminate()
      } catch {
        // no-op
      }
      state[resolvedSource].ws = null
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
      console.log(`[stt:${resolvedSource}] ws open`)
      state[resolvedSource].streaming = true
      send('stt:status', { source: resolvedSource, status: 'connecting' })
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        console.log(`[stt:${resolvedSource}] message`, msg.type, msg.transcript ?? '')
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
      } catch (err) {
        console.log(`[stt:${resolvedSource}] parse error`, err, raw.toString().slice(0, 200))
      }
    })

    ws.on('error', (error: Error) => {
      console.log(`[stt:${resolvedSource}] ws error`, error.message)
      send('stt:error', { source: resolvedSource, error: error.message })
      resetSource(resolvedSource)
    })

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[stt:${resolvedSource}] ws close`, code, reason.toString())
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
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'Terminate' }))
        }
      } catch {
        // no-op
      }
      // Sending Terminate alone doesn't close the socket — AssemblyAI's own
      // Termination reply would, but we're not waiting for it, so force-close now.
      try {
        ws.terminate()
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
