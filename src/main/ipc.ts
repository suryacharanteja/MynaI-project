import { desktopCapturer, ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type AskAiError,
  type AskAiRequest,
  type AskAiResult,
  type CreateSessionResult,
  type SessionSummary,
  type SttStartResult
} from '../shared/ipc-contract'
import type { DesktopSource } from '../shared/stt-types'
import type { CreateSessionForm } from '../shared/session-types'
import { readSettings, writeSettings } from './store'
import { askLlm } from './services/llm/router'
import { createSession, listSessions } from './sessions/store'
import { createAssemblyAiSttService } from './services/stt/assemblyai'

const PROVIDER_LABELS = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  'opencode-go': 'OpenCode Go',
  'opencode-zen': 'OpenCode Zen'
} as const

function apiKeyForProvider(settings: AppSettings, provider: AskAiRequest['provider']): string | null {
  switch (provider) {
    case 'gemini':
      return settings.geminiApiKey
    case 'openai':
      return settings.openaiApiKey
    case 'opencode-go':
      return settings.openCodeGoApiKey
    case 'opencode-zen':
      return settings.openCodeZenApiKey
  }
}

export function registerIpcHandlers(window: BrowserWindow): void {
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

  const stt = createAssemblyAiSttService(window.webContents)
  window.on('closed', () => stt.dispose())

  ipcMain.handle(IPC_CHANNELS.sttGetDesktopSources, async (): Promise<DesktopSource[]> => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  })

  ipcMain.handle(IPC_CHANNELS.sttStart, (_event, source: string): SttStartResult => {
    const settings = readSettings()
    if (!settings.assemblyAiApiKey) {
      return { success: false, error: 'AssemblyAI API key not configured. Add it in Settings.' }
    }
    return stt.start(source, settings.assemblyAiApiKey)
  })

  ipcMain.handle(IPC_CHANNELS.sttStop, (_event, source: string) => {
    stt.stop(source)
  })

  ipcMain.on(IPC_CHANNELS.sttAudioChunk, (_event: IpcMainEvent, { source, data }: { source: string; data: ArrayBuffer }) => {
    stt.pushAudioChunk(source, data)
  })
}
