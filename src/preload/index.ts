import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppSettings,
  type AskAiRequest,
  type AskAiChunkEvent,
  type AskAiDoneEvent,
  type AskAiErrorEvent,
  type ShortcutTriggeredEvent,
  type MynaiApi
} from '../shared/ipc-contract'
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
  askAiStart: (request: AskAiRequest) => ipcRenderer.invoke(IPC_CHANNELS.aiAskStart, request),
  onAiChunk: (callback: (event: AskAiChunkEvent) => void) => subscribe(IPC_CHANNELS.aiChunk, callback),
  onAiDone: (callback: (event: AskAiDoneEvent) => void) => subscribe(IPC_CHANNELS.aiDone, callback),
  onAiError: (callback: (event: AskAiErrorEvent) => void) => subscribe(IPC_CHANNELS.aiError, callback),

  // Raw channel names owned by the electron-audio-loopback package itself
  // (see node_modules/electron-audio-loopback/dist/config.js) — not routed
  // through our own IPC_CHANNELS since we don't own the handler side of
  // these, `initMain()` in src/main/index.ts does.
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),

  sttGetDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.sttGetDesktopSources),
  sttStart: (source: string) => ipcRenderer.invoke(IPC_CHANNELS.sttStart, source),
  sttStop: (source: string) => ipcRenderer.invoke(IPC_CHANNELS.sttStop, source),
  sttSendAudioChunk: (source: string, data: ArrayBuffer) =>
    ipcRenderer.send(IPC_CHANNELS.sttAudioChunk, { source, data }),
  onSttStatus: (callback: (event: SttStatusEvent) => void) => subscribe(IPC_CHANNELS.sttStatus, callback),
  onSttPartial: (callback: (event: SttTranscriptEvent) => void) => subscribe(IPC_CHANNELS.sttPartial, callback),
  onSttFinal: (callback: (event: SttTranscriptEvent) => void) => subscribe(IPC_CHANNELS.sttFinal, callback),
  onSttError: (callback: (event: SttErrorEvent) => void) => subscribe(IPC_CHANNELS.sttError, callback),

  windowMinimize: () => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
  windowRestore: () => ipcRenderer.send(IPC_CHANNELS.windowRestore),
  windowClose: () => ipcRenderer.send(IPC_CHANNELS.windowClose),

  onShortcutTriggered: (callback: (event: ShortcutTriggeredEvent) => void) =>
    subscribe(IPC_CHANNELS.shortcutTriggered, callback),

  screenshotCapture: () => ipcRenderer.invoke(IPC_CHANNELS.screenshotCapture)
}

contextBridge.exposeInMainWorld('mynai', api)
