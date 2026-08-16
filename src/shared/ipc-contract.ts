import type { CreateSessionForm, LlmProvider } from './session-types'
import type { DesktopSource, SttErrorEvent, SttStatusEvent, SttTranscriptEvent } from './stt-types'

export type { LlmProvider } from './session-types'

export const IPC_CHANNELS = {
  getSettings: 'app:getSettings',
  setSettings: 'app:setSettings',
  createSession: 'session:create',
  listSessions: 'session:list',
  askAi: 'ai:ask',
  sttGetDesktopSources: 'stt:getDesktopSources',
  sttStart: 'stt:start',
  sttStop: 'stt:stop',
  sttAudioChunk: 'stt:audioChunk',
  sttStatus: 'stt:status',
  sttPartial: 'stt:partial',
  sttFinal: 'stt:final',
  sttError: 'stt:error'
} as const

export interface AppSettings {
  geminiApiKey: string | null
  assemblyAiApiKey: string | null
  openaiApiKey: string | null
  openCodeGoApiKey: string | null
  openCodeZenApiKey: string | null
}

export const defaultAppSettings: AppSettings = {
  geminiApiKey: null,
  assemblyAiApiKey: null,
  openaiApiKey: null,
  openCodeGoApiKey: null,
  openCodeZenApiKey: null
}

export interface CreateSessionResult {
  ok: true
  sessionId: string
}

export interface SessionSummary {
  id: string
  form: CreateSessionForm
  createdAt: string
  updatedAt: string
}

export interface AskAiRequest {
  question: string
  provider: LlmProvider
  model: string
  company?: string
  jobDescription?: string
  extraContext?: string
}

export interface AskAiResult {
  question: string
  answer: string
  keySteps: string[]
  code: { language: string; content: string } | null
  explanation: string
  timeComplexity: string | null
  spaceComplexity: string | null
}

export interface AskAiError {
  error: string
}

export interface SttStartResult {
  success: boolean
  error?: string
}

export interface MynaiApi {
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  createSession: (form: CreateSessionForm) => Promise<CreateSessionResult>
  listSessions: () => Promise<SessionSummary[]>
  askAi: (request: AskAiRequest) => Promise<AskAiResult | AskAiError>
  sttGetDesktopSources: () => Promise<DesktopSource[]>
  sttStart: (source: string) => Promise<SttStartResult>
  sttStop: (source: string) => Promise<void>
  sttSendAudioChunk: (source: string, data: ArrayBuffer) => void
  onSttStatus: (callback: (event: SttStatusEvent) => void) => () => void
  onSttPartial: (callback: (event: SttTranscriptEvent) => void) => () => void
  onSttFinal: (callback: (event: SttTranscriptEvent) => void) => () => void
  onSttError: (callback: (event: SttErrorEvent) => void) => () => void
}
