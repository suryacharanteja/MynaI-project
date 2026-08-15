import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { type AppSettings, defaultAppSettings } from '../shared/ipc-contract'

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'mynai-settings.json')
}

export function readSettings(): AppSettings {
  const filePath = settingsFilePath()
  if (!existsSync(filePath)) {
    return { ...defaultAppSettings }
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    return { ...defaultAppSettings, ...raw }
  } catch {
    return { ...defaultAppSettings }
  }
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), 'utf-8')
}
