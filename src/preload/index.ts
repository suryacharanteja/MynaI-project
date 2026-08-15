import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppSettings, type AskAiRequest, type MynaiApi } from '../shared/ipc-contract'
import type { CreateSessionForm } from '../shared/session-types'
import type { SttErrorEvent, SttStatusEvent, SttTranscriptEvent } from '../shared/stt-types'

function subscribe<T>(channel: string, callback: (event: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MynaiApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, patch),
  createSession: (form: CreateSessionForm) => ipcRenderer.invoke(IPC_CHANNELS.createSession, form),
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.listSessions),
  askAi: (request: AskAiRequest) => ipcRenderer.invoke(IPC_CHANNELS.askAi, request),

  sttGetDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.sttGetDesktopSources),
  sttStart: (source: string) => ipcRenderer.invoke(IPC_CHANNELS.sttStart, source),
  sttStop: (source: string) => ipcRenderer.invoke(IPC_CHANNELS.sttStop, source),
  sttSendAudioChunk: (source: string, data: ArrayBuffer) =>
    ipcRenderer.send(IPC_CHANNELS.sttAudioChunk, { source, data }),
  onSttStatus: (callback: (event: SttStatusEvent) => void) => subscribe(IPC_CHANNELS.sttStatus, callback),
  onSttPartial: (callback: (event: SttTranscriptEvent) => void) => subscribe(IPC_CHANNELS.sttPartial, callback),
  onSttFinal: (callback: (event: SttTranscriptEvent) => void) => subscribe(IPC_CHANNELS.sttFinal, callback),
  onSttError: (callback: (event: SttErrorEvent) => void) => subscribe(IPC_CHANNELS.sttError, callback)
}

contextBridge.exposeInMainWorld('mynai', api)
