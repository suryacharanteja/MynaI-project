import { app, desktopCapturer, ipcMain, screen, type BrowserWindow, type IpcMainEvent, type Rectangle } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type AskAiError,
  type AskAiRequest,
  type AskAiResult,
  type CreateSessionError,
  type CreateSessionResult,
  type SessionSummary,
  type SttStartResult
} from '../shared/ipc-contract'
import type { DesktopSource } from '../shared/stt-types'
import { readSettings, writeSettings } from './store'
import { askLlm } from './services/llm/router'
import { createSession, listSessions } from './sessions/store'
import { createAssemblyAiSttService } from './services/stt/assemblyai'
import {
  appSettingsSchema,
  askAiRequestSchema,
  createSessionFormSchema,
  sttSourceSchema
} from '../shared/schemas'

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

const MINI_SIZE = 64
const MINI_MARGIN = 16

export function registerIpcHandlers(window: BrowserWindow): void {
  const originalMinimumSize = window.getMinimumSize()
  let previousBounds: Rectangle | null = null

  ipcMain.on(IPC_CHANNELS.windowMinimize, () => {
    if (window.isDestroyed()) return
    previousBounds = window.getBounds()
    const display = screen.getDisplayMatching(previousBounds)
    const x = display.workArea.x + display.workArea.width - MINI_SIZE - MINI_MARGIN
    const y = display.workArea.y + MINI_MARGIN
    window.setMinimumSize(MINI_SIZE, MINI_SIZE)
    window.setBounds({ x, y, width: MINI_SIZE, height: MINI_SIZE })
  })

  ipcMain.on(IPC_CHANNELS.windowRestore, () => {
    if (window.isDestroyed()) return
    window.setMinimumSize(originalMinimumSize[0], originalMinimumSize[1])
    if (previousBounds) {
      window.setBounds(previousBounds)
      previousBounds = null
    } else {
      window.setSize(420, 640)
    }
  })

  ipcMain.handle(IPC_CHANNELS.getSettings, () => readSettings())

  ipcMain.handle(IPC_CHANNELS.setSettings, (_event, patch: Partial<AppSettings>) => {
    const parsed = appSettingsSchema.partial().safeParse(patch)
    if (!parsed.success) {
      return readSettings()
    }
    const next = { ...readSettings(), ...parsed.data }
    writeSettings(next)
    return next
  })

  ipcMain.handle(
    IPC_CHANNELS.createSession,
    (_event, form: unknown): CreateSessionResult | CreateSessionError => {
      const parsed = createSessionFormSchema.safeParse(form)
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        return { ok: false, error: firstIssue?.message ?? 'Invalid session form' }
      }
      const session = createSession(parsed.data)
      return { ok: true, sessionId: session.id }
    }
  )

  ipcMain.handle(IPC_CHANNELS.listSessions, (): SessionSummary[] => listSessions())

  ipcMain.handle(
    IPC_CHANNELS.askAi,
    async (_event, request: unknown): Promise<AskAiResult | AskAiError> => {
      const parsed = askAiRequestSchema.safeParse(request)
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        return { error: firstIssue?.message ?? 'Invalid request' }
      }
      const req = parsed.data
      const settings = readSettings()
      const apiKey = apiKeyForProvider(settings, req.provider)
      if (!apiKey) {
        return { error: `No ${PROVIDER_LABELS[req.provider]} API key configured. Open Settings and add one.` }
      }
      try {
        return await askLlm(req.provider, {
          apiKey,
          model: req.model,
          question: req.question,
          company: req.company,
          jobDescription: req.jobDescription,
          extraContext: req.extraContext,
          answerPreferences: req.answerPreferences
        })
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Ask AI failed.' }
      }
    }
  )

  const stt = createAssemblyAiSttService(window.webContents)
  window.on('closed', () => stt.dispose())

  ipcMain.on(IPC_CHANNELS.windowClose, () => {
    // closable:false (required to suppress the native close button on a
    // frameless stealth overlay) also makes graceful app.quit() no-op on
    // Windows, since it tries the window's close path first and the window
    // refuses. Tear down explicitly and force-exit instead.
    stt.dispose()
    if (!window.isDestroyed()) window.destroy()
    app.exit(0)
  })

  ipcMain.handle(IPC_CHANNELS.sttGetDesktopSources, async (): Promise<DesktopSource[]> => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  })

  ipcMain.handle(IPC_CHANNELS.sttStart, (_event, source: unknown): SttStartResult => {
    const parsed = sttSourceSchema.safeParse(source)
    if (!parsed.success) {
      return { success: false, error: 'Invalid audio source. Must be "mic" or "system".' }
    }
    const settings = readSettings()
    if (!settings.assemblyAiApiKey) {
      return { success: false, error: 'AssemblyAI API key not configured. Add it in Settings.' }
    }
    return stt.start(parsed.data, settings.assemblyAiApiKey)
  })

  ipcMain.handle(IPC_CHANNELS.sttStop, (_event, source: unknown) => {
    const parsed = sttSourceSchema.safeParse(source)
    if (parsed.success) {
      stt.stop(parsed.data)
    }
  })

  ipcMain.on(IPC_CHANNELS.sttAudioChunk, (_event: IpcMainEvent, { source, data }: { source: string; data: ArrayBuffer }) => {
    const parsed = sttSourceSchema.safeParse(source)
    if (parsed.success) {
      stt.pushAudioChunk(parsed.data, data)
    }
  })
}
