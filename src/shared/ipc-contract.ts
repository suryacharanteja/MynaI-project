import type { CreateSessionForm, LlmProvider } from './session-types'

export type { LlmProvider } from './session-types'

export const IPC_CHANNELS = {
  getSettings: 'app:getSettings',
  setSettings: 'app:setSettings',
  createSession: 'session:create',
  listSessions: 'session:list',
  askAi: 'ai:ask'
} as const

export interface AppSettings {
  geminiApiKey: string | null
  assemblyAiApiKey: string | null
  openaiApiKey: string | null
  openCodeZenApiKey: string | null
}

export const defaultAppSettings: AppSettings = {
  geminiApiKey: null,
  assemblyAiApiKey: null,
  openaiApiKey: null,
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

export interface MynaiApi {
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  createSession: (form: CreateSessionForm) => Promise<CreateSessionResult>
  listSessions: () => Promise<SessionSummary[]>
  askAi: (request: AskAiRequest) => Promise<AskAiResult | AskAiError>
}
