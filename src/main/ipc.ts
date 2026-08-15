import { ipcMain, type BrowserWindow } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type AskAiError,
  type AskAiRequest,
  type AskAiResult,
  type CreateSessionResult,
  type SessionSummary
} from '../shared/ipc-contract'
import type { CreateSessionForm } from '../shared/session-types'
import { readSettings, writeSettings } from './store'
import { askLlm } from './services/llm/router'
import { createSession, listSessions } from './sessions/store'

const PROVIDER_LABELS = { gemini: 'Gemini', openai: 'OpenAI', 'opencode-go': 'OpenCode Go' } as const

function apiKeyForProvider(settings: AppSettings, provider: AskAiRequest['provider']): string | null {
  switch (provider) {
    case 'gemini':
      return settings.geminiApiKey
    case 'openai':
      return settings.openaiApiKey
    case 'opencode-go':
      return settings.openCodeGoApiKey
  }
}

export function registerIpcHandlers(_window: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.getSettings, () => readSettings())

  ipcMain.handle(IPC_CHANNELS.setSettings, (_event, patch: Partial<AppSettings>) => {
    const next = { ...readSettings(), ...patch }
    writeSettings(next)
    return next
  })

  ipcMain.handle(IPC_CHANNELS.createSession, (_event, form: CreateSessionForm): CreateSessionResult => {
    const session = createSession(form)
    return { ok: true, sessionId: session.id }
  })

  ipcMain.handle(IPC_CHANNELS.listSessions, (): SessionSummary[] => listSessions())

  ipcMain.handle(
    IPC_CHANNELS.askAi,
    async (_event, request: AskAiRequest): Promise<AskAiResult | AskAiError> => {
      const settings = readSettings()
      const apiKey = apiKeyForProvider(settings, request.provider)
      if (!apiKey) {
        return { error: `No ${PROVIDER_LABELS[request.provider]} API key configured. Open Settings and add one.` }
      }
      try {
        return await askLlm(request.provider, {
          apiKey,
          model: request.model,
          question: request.question,
          company: request.company,
          jobDescription: request.jobDescription,
          extraContext: request.extraContext
        })
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Ask AI failed.' }
      }
    }
  )
}
