import { randomUUID } from 'crypto'
import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS, type AppSettings, type CreateSessionResult } from '../shared/ipc-contract'
import type { CreateSessionForm } from '../shared/session-types'
import { readSettings, writeSettings } from './store'

export function registerIpcHandlers(_window: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.getSettings, () => readSettings())

  ipcMain.handle(IPC_CHANNELS.setSettings, (_event, patch: Partial<AppSettings>) => {
    const next = { ...readSettings(), ...patch }
    writeSettings(next)
    return next
  })

  ipcMain.handle(IPC_CHANNELS.createSession, (_event, _form: CreateSessionForm): CreateSessionResult => {
    return { ok: true, sessionId: randomUUID() }
  })
}
