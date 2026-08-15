import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppSettings, type AskAiRequest, type MynaiApi } from '../shared/ipc-contract'
import type { CreateSessionForm } from '../shared/session-types'

const api: MynaiApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, patch),
  createSession: (form: CreateSessionForm) => ipcRenderer.invoke(IPC_CHANNELS.createSession, form),
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.listSessions),
  askAi: (request: AskAiRequest) => ipcRenderer.invoke(IPC_CHANNELS.askAi, request)
}

contextBridge.exposeInMainWorld('mynai', api)
