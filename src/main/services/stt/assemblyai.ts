import WebSocket from 'ws'
import type { WebContents } from 'electron'
import type { SttSource } from '../../../shared/stt-types'
import { safeSend } from '../../utils/safe-send'

const SAMPLE_RATE = 16000
const WATCHDOG_INTERVAL_MS = 1000
const STALE_WARNING_MS = 15000
const STALE_RECONNECT_MS = 30000
const MAX_CONNECT_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 16000

/**
 * `streaming.assemblyai.com` is the default edge-routing endpoint; AssemblyAI
 * also runs region-pinned hosts for data-residency accounts. If the edge host
 * fails to even connect (DNS failure, refused, timeout — never reaches
 * "open"), cycle through the region hosts before falling back to timed
 * retries, since a region-provisioned key may not route reliably through the
 * generic edge host on every network.
 */
const STT_HOSTS = ['streaming.assemblyai.com', 'streaming.eu.assemblyai.com', 'streaming.us.assemblyai.com']

function normalizeSource(source: string): SttSource {
  return source === 'system' ? 'system' : 'mic'
}

/**
 * The `ws` library surfaces raw Node errors (DNS failures, ECONNRESET, etc.)
 * with no classification of its own — without this, a transient network blip
 * shows the user "getaddrinfo ENOTFOUND streaming.assemblyai.com" instead of
 * something actionable.
 */
function classifyConnectError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('enotfound') || lower.includes('eai_again') || lower.includes('getaddrinfo')) {
    return "Can't reach the transcription service — check your internet connection."
  }
  if (lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('etimedout')) {
    return 'Transcription service connection was interrupted.'
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
    return 'Invalid AssemblyAI API key. Check it in Settings.'
  }
  return message
}

interface SourceState {
  ws: WebSocket | null
  streaming: boolean
  closingIntentionally: boolean
  lastMessageAt: number
  apiKey: string
  retryCount: number
  retryTimer: ReturnType<typeof setTimeout> | null
  hostIndex: number
}

function createSourceState(): SourceState {
  return {
    ws: null,
    streaming: false,
    closingIntentionally: false,
    lastMessageAt: 0,
    apiKey: '',
    retryCount: 0,
    retryTimer: null,
    hostIndex: 0
  }
}

export function createAssemblyAiSttService(webContents: WebContents) {
  const state: Record<SttSource, SourceState> = {
    mic: createSourceState(),
    system: createSourceState()
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

  function clearRetryTimer(source: SttSource): void {
    const timer = state[source].retryTimer
    if (timer) {
      clearTimeout(timer)
      state[source].retryTimer = null
    }
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
          connect(source, s.apiKey)
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

  /**
   * Schedules a reconnect attempt for a source that failed before ever
   * reaching "open". Cycles through STT_HOSTS immediately (no delay — a
   * region-mismatched host fails fast, so trying the next one costs little),
   * then once all hosts have been tried, backs off exponentially and repeats
   * the cycle up to MAX_CONNECT_RETRIES total attempts.
   */
  function scheduleRetry(source: SttSource): void {
    const s = state[source]
    if (s.closingIntentionally) return

    s.retryCount += 1
    if (s.retryCount > MAX_CONNECT_RETRIES) {
      send('stt:error', {
        source,
        error: "Couldn't connect to the transcription service after several attempts. Check your connection and try again."
      })
      return
    }

    s.hostIndex = (s.hostIndex + 1) % STT_HOSTS.length
    const completedFullCycle = s.hostIndex === 0
    const delay = completedFullCycle
      ? Math.min(BASE_RETRY_DELAY_MS * 2 ** (s.retryCount - 1), MAX_RETRY_DELAY_MS)
      : 0

    clearRetryTimer(source)
    s.retryTimer = setTimeout(() => {
      s.retryTimer = null
      if (!s.closingIntentionally) connect(source, s.apiKey)
    }, delay)
  }

  function connect(source: SttSource, apiKey: string): void {
    const s = state[source]
    const host = STT_HOSTS[s.hostIndex]

    const query = new URLSearchParams({
      sample_rate: String(SAMPLE_RATE),
      format_turns: 'true'
    })
    const ws = new WebSocket(`wss://${host}/v3/ws?${query.toString()}`, {
      headers: { Authorization: apiKey }
    })
    s.ws = ws
    s.closingIntentionally = false
    s.lastMessageAt = Date.now()

    let openedThisAttempt = false

    ws.on('open', () => {
      openedThisAttempt = true
      s.streaming = true
      s.retryCount = 0
      s.lastMessageAt = Date.now()
      send('stt:status', { source, status: 'connecting' })
      startWatchdog()
    })

    ws.on('message', (raw: Buffer) => {
      s.lastMessageAt = Date.now()
      try {
        const msg = JSON.parse(raw.toString())
        switch (msg.type) {
          case 'Begin':
            send('stt:status', { source, status: 'listening' })
            break
          case 'Turn':
            if (msg.transcript) {
              send(msg.end_of_turn ? 'stt:final' : 'stt:partial', { source, text: msg.transcript })
            }
            break
          case 'Termination':
            resetSource(source)
            send('stt:status', { source, status: 'off' })
            break
        }
      } catch {
        // ignore malformed frames
      }
    })

    ws.on('error', (error: Error) => {
      const intentional = s.closingIntentionally
      resetSource(source)
      if (intentional) return

      if (!openedThisAttempt) {
        // Never connected this attempt — a candidate for host fallback / backoff retry.
        scheduleRetry(source)
        if (s.retryCount === 1) {
          send('stt:error', { source, error: classifyConnectError(error.message) })
        }
      } else {
        send('stt:error', { source, error: classifyConnectError(error.message) })
      }
    })

    ws.on('close', () => {
      const wasIntentional = s.closingIntentionally
      if (s.streaming) {
        resetSource(source)
        if (!wasIntentional) {
          send('stt:status', { source, status: 'off' })
        }
      } else if (!wasIntentional && !openedThisAttempt) {
        // Closed before ever opening and no 'error' fired (some hosts just
        // refuse the handshake silently) — still needs a retry.
        scheduleRetry(source)
      }
    })
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
    clearRetryTimer(resolvedSource)

    state[resolvedSource].apiKey = apiKey
    state[resolvedSource].retryCount = 0
    // Keep hostIndex as-is: if a previous session already learned which host
    // works for this key/network, reuse it instead of re-probing from edge.

    connect(resolvedSource, apiKey)

    return { success: true }
  }

  function resetSource(source: SttSource): void {
    state[source].ws = null
    state[source].streaming = false
    stopWatchdog()
  }

  function stop(source: string): void {
    const resolvedSource = normalizeSource(source)
    clearRetryTimer(resolvedSource)
    state[resolvedSource].closingIntentionally = true
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
    state[resolvedSource].retryCount = 0
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
