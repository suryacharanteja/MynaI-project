import WebSocket from 'ws'
import type { WebContents } from 'electron'
import type { SttSource } from '../../../shared/stt-types'
import { safeSend } from '../../utils/safe-send'

const SAMPLE_RATE = 16000
const WATCHDOG_INTERVAL_MS = 1000
const STALE_WARNING_MS = 15000
const STALE_RECONNECT_MS = 30000

function normalizeSource(source: string): SttSource {
  return source === 'system' ? 'system' : 'mic'
}

interface SourceState {
  ws: WebSocket | null
  streaming: boolean
  closingIntentionally: boolean
  lastMessageAt: number
  apiKey: string
}

export function createAssemblyAiSttService(webContents: WebContents) {
  const state: Record<SttSource, SourceState> = {
    mic: { ws: null, streaming: false, closingIntentionally: false, lastMessageAt: 0, apiKey: '' },
    system: { ws: null, streaming: false, closingIntentionally: false, lastMessageAt: 0, apiKey: '' }
  }

  let watchdogTimer: ReturnType<typeof setInterval> | null = null

  function send(channel: string, payload: unknown): void {
    safeSend(webContents, channel, payload)
  }

  function terminateQuietly(source: SttSource): void {
    const ws = state[source].ws
    if (!ws) return
    state[source].closingIntentionally = true
    try {
      ws.terminate()
    } catch {
      // no-op
    }
    state[source].ws = null
  }

  function startWatchdog(): void {
    if (watchdogTimer) return
    watchdogTimer = setInterval(() => {
      for (const source of ['mic', 'system'] as SttSource[]) {
        const s = state[source]
        if (!s.streaming || !s.ws) continue
        const elapsed = Date.now() - s.lastMessageAt
        if (elapsed >= STALE_RECONNECT_MS) {
          send('stt:error', { source, error: 'Connection lost. Reconnecting...' })
          terminateQuietly(source)
          s.streaming = false
          start(source, s.apiKey)
        } else if (elapsed >= STALE_WARNING_MS) {
          send('stt:error', { source, error: 'Connection may be stale. Waiting for data...' })
        }
      }
    }, WATCHDOG_INTERVAL_MS)
  }

  function stopWatchdog(): void {
    const anyActive = state.mic.streaming || state.system.streaming
    if (!anyActive && watchdogTimer) {
      clearInterval(watchdogTimer)
      watchdogTimer = null
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

    terminateQuietly(resolvedSource)

    state[resolvedSource].apiKey = apiKey

    const query = new URLSearchParams({
      sample_rate: String(SAMPLE_RATE),
      format_turns: 'true'
    })
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${query.toString()}`, {
      headers: { Authorization: apiKey }
    })
    state[resolvedSource].ws = ws
    state[resolvedSource].closingIntentionally = false
    state[resolvedSource].lastMessageAt = Date.now()

    ws.on('open', () => {
      state[resolvedSource].streaming = true
      state[resolvedSource].lastMessageAt = Date.now()
      send('stt:status', { source: resolvedSource, status: 'connecting' })
      startWatchdog()
    })

    ws.on('message', (raw: Buffer) => {
      state[resolvedSource].lastMessageAt = Date.now()
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
      const intentional = state[resolvedSource].closingIntentionally
      resetSource(resolvedSource)
      if (!intentional) {
        send('stt:error', { source: resolvedSource, error: error.message })
      }
    })

    ws.on('close', () => {
      const wasIntentional = state[resolvedSource].closingIntentionally
      if (state[resolvedSource].streaming) {
        resetSource(resolvedSource)
        if (!wasIntentional) {
          send('stt:status', { source: resolvedSource, status: 'off' })
        }
      }
    })

    return { success: true }
  }

  function resetSource(source: SttSource): void {
    state[source].ws = null
    state[source].streaming = false
    stopWatchdog()
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
    terminateQuietly(resolvedSource)
    state[resolvedSource].streaming = false
    stopWatchdog()
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
    if (watchdogTimer) {
      clearInterval(watchdogTimer)
      watchdogTimer = null
    }
  }

  return { start, stop, pushAudioChunk, dispose }
}

export type AssemblyAiSttService = ReturnType<typeof createAssemblyAiSttService>
