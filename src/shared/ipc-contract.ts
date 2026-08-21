import type { AnswerPreferences, CreateSessionForm, LlmProvider } from './session-types'
import type { DesktopSource, SttErrorEvent, SttStatusEvent, SttTranscriptEvent } from './stt-types'

export type { LlmProvider } from './session-types'

export const IPC_CHANNELS = {
  getSettings: 'app:getSettings',
  setSettings: 'app:setSettings',
  createSession: 'session:create',
  listSessions: 'session:list',
  aiAskStart: 'ai:askStart',
  aiChunk: 'ai:chunk',
  aiDone: 'ai:done',
  aiError: 'ai:error',
  sttGetDesktopSources: 'stt:getDesktopSources',
  sttStart: 'stt:start',
  sttStop: 'stt:stop',
  sttAudioChunk: 'stt:audioChunk',
  sttStatus: 'stt:status',
  sttPartial: 'stt:partial',
  sttFinal: 'stt:final',
  sttError: 'stt:error',
  windowMinimize: 'window:minimize',
  windowRestore: 'window:restore',
  windowClose: 'window:close',
  shortcutTriggered: 'shortcut:triggered'
} as const

export const SHORTCUT_IDS = [
  'follow-up-code',
  'follow-up-detail',
  'follow-up-complexity',
  'follow-up-voice'
] as const
export type ShortcutId = (typeof SHORTCUT_IDS)[number]

export interface AppSettings {
  geminiApiKey: string | null
  assemblyAiApiKey: string | null
  openaiApiKey: string | null
  openCodeGoApiKey: string | null
  openCodeZenApiKey: string | null
  deepseekApiKey: string | null
}

export const defaultAppSettings: AppSettings = {
  geminiApiKey: null,
  assemblyAiApiKey: null,
  openaiApiKey: null,
  openCodeGoApiKey: null,
  openCodeZenApiKey: null,
  deepseekApiKey: null
}

export interface CreateSessionResult {
  ok: true
  sessionId: string
}

export interface CreateSessionError {
  ok: false
  error: string
}

export interface SessionSummary {
  id: string
  form: CreateSessionForm
  createdAt: string
  updatedAt: string
}

export interface PriorAnswerPayload {
  answer: string
  keySteps?: string[]
  code?: { language: string; content: string }
  explanation?: string
  timeComplexity?: string
  spaceComplexity?: string
}

export interface AskAiRequest {
  cardId: string
  question: string
  provider: LlmProvider
  model: string
  company?: string
  jobDescription?: string
  extraContext?: string
  answerPreferences?: AnswerPreferences
  /** Set only for a follow-up ask on an existing card — see priorAnswer. */
  followUpInstruction?: string
  priorAnswer?: PriorAnswerPayload
}

export interface AskAiStartResult {
  cardId: string
  error?: string
}

export interface AskAiChunkEvent {
  cardId: string
  delta: string
}

export interface AskAiDoneEvent {
  cardId: string
}

export interface AskAiErrorEvent {
  cardId: string
  error: string
  /** true = content had already streamed in before the failure — the
   *  renderer should append a trailing note, not clear/replace the card. */
  partial: boolean
}

export interface SttStartResult {
  success: boolean
  error?: string
}

export interface ShortcutTriggeredEvent {
  id: ShortcutId
}

export interface MynaiApi {
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  createSession: (form: CreateSessionForm) => Promise<CreateSessionResult | CreateSessionError>
  listSessions: () => Promise<SessionSummary[]>
  askAiStart: (request: AskAiRequest) => Promise<AskAiStartResult>
  onAiChunk: (callback: (event: AskAiChunkEvent) => void) => () => void
  onAiDone: (callback: (event: AskAiDoneEvent) => void) => () => void
  onAiError: (callback: (event: AskAiErrorEvent) => void) => () => void
  enableLoopbackAudio: () => Promise<void>
  disableLoopbackAudio: () => Promise<void>
  sttGetDesktopSources: () => Promise<DesktopSource[]>
  sttStart: (source: string) => Promise<SttStartResult>
  sttStop: (source: string) => Promise<void>
  sttSendAudioChunk: (source: string, data: ArrayBuffer) => void
  onSttStatus: (callback: (event: SttStatusEvent) => void) => () => void
  onSttPartial: (callback: (event: SttTranscriptEvent) => void) => () => void
  onSttFinal: (callback: (event: SttTranscriptEvent) => void) => () => void
  onSttError: (callback: (event: SttErrorEvent) => void) => () => void

  windowMinimize: () => void
  windowRestore: () => void
  windowClose: () => void

  onShortcutTriggered: (callback: (event: ShortcutTriggeredEvent) => void) => () => void
}
