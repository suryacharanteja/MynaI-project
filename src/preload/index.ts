import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppSettings, type MynaiApi } from '../shared/ipc-contract'
import type { CreateSessionForm } from '../shared/session-types'

const api: MynaiApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, patch),
  createSession: (form: CreateSessionForm) => ipcRenderer.invoke(IPC_CHANNELS.createSession, form)
}

contextBridge.exposeInMainWorld('mynai', api)
