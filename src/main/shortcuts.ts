import { globalShortcut, type BrowserWindow } from 'electron'
import { IPC_CHANNELS, type ShortcutId } from '../shared/ipc-contract'
import { safeSend } from './utils/safe-send'

/**
 * No typing anywhere in the follow-up feature — a shortcut requires no mouse
 * movement or window-focus change away from whatever the user is sharing
 * (their coding editor), and fires silently and instantly. This is genuinely
 * safer than even a single click, not just more convenient.
 */
const BINDINGS: { accelerator: string; id: ShortcutId }[] = [
  { accelerator: 'Alt+Shift+C', id: 'follow-up-code' },
  { accelerator: 'Alt+Shift+D', id: 'follow-up-detail' },
  { accelerator: 'Alt+Shift+X', id: 'follow-up-complexity' },
  { accelerator: 'Alt+Shift+V', id: 'follow-up-voice' },
  { accelerator: 'Alt+Shift+R', id: 'reask-relisten' }
]

export function registerGlobalShortcuts(window: BrowserWindow): void {
  for (const { accelerator, id } of BINDINGS) {
    const ok = globalShortcut.register(accelerator, () => {
      safeSend(window.webContents, IPC_CHANNELS.shortcutTriggered, { id })
    })
    if (!ok) {
      // Another app already owns this combo on the user's system — the chip
      // click still works, so this is a silent degrade, not a hard failure.
      console.warn(`[shortcuts] Failed to register ${accelerator} for ${id} — likely already bound by another app.`)
    }
  }
}
