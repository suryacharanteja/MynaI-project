import { contextBridge } from 'electron'

const api = {}

contextBridge.exposeInMainWorld('mynai', api)
