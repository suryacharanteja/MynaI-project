import type { CreateSessionForm } from './session-types'

export const IPC_CHANNELS = {
  getSettings: 'app:getSettings',
  setSettings: 'app:setSettings',
  createSession: 'session:create'
} as const

export interface AppSettings {
  geminiApiKey: string | null
  assemblyAiApiKey: string | null
}

export const defaultAppSettings: AppSettings = {
  geminiApiKey: null,
  assemblyAiApiKey: null
}

export interface CreateSessionResult {
  ok: true
  sessionId: string
}

export interface MynaiApi {
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  createSession: (form: CreateSessionForm) => Promise<CreateSessionResult>
}
