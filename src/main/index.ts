import { app, BrowserWindow, dialog, globalShortcut } from 'electron'
import { initMain as initLoopbackAudio } from 'electron-audio-loopback'
import { createOverlayWindow } from './windows/overlay'
import { registerIpcHandlers } from './ipc'
import { registerGlobalShortcuts } from './shortcuts'

// Sets Chromium command-line feature flags for system-audio loopback — must
// run before app.whenReady(), since Chromium reads --enable-features at
// startup. Replaces the old chromeMediaSource:'desktop' getUserMedia hack,
// which frequently "succeeded" with a track that carried no actual audio
// data on Windows — the root cause of system audio silently producing zero
// transcript with no error shown.
initLoopbackAudio()

let overlayWindow: BrowserWindow | null = null

process.on('uncaughtException', (error) => {
  console.error('[MynaI] Uncaught exception:', error)
  dialog.showErrorBox('MynaI Error', `An unexpected error occurred:\n${error.message}`)
})

process.on('unhandledRejection', (reason) => {
  console.error('[MynaI] Unhandled rejection:', reason)
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (overlayWindow) {
      if (overlayWindow.isMinimized()) overlayWindow.restore()
      overlayWindow.show()
      overlayWindow.focus()
    }
  })

  app.whenReady().then(() => {
    overlayWindow = createOverlayWindow({
      defaultWidth: 420,
      defaultHeight: 640,
      minWidth: 360,
      minHeight: 240,
      hideFromScreenCapture: process.env['MYNAI_DEV_VISIBLE'] !== '1',
      launchHidden: false
    })
    registerIpcHandlers(overlayWindow)
    registerGlobalShortcuts(overlayWindow)

    overlayWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[MynaI] Renderer crashed:', details.reason)
      dialog
        .showMessageBox({
          type: 'error',
          title: 'MynaI',
          message: 'The renderer process crashed.',
          detail: `Reason: ${details.reason}`,
          buttons: ['Restart', 'Quit']
        })
        .then(({ response }) => {
          if (response === 0) {
            overlayWindow?.reload()
          } else {
            app.quit()
          }
        })
    })

    overlayWindow.on('unresponsive', () => {
      console.error('[MynaI] Window became unresponsive')
      dialog
        .showMessageBox({
          type: 'warning',
          title: 'MynaI',
          message: 'The window is not responding.',
          buttons: ['Wait', 'Restart']
        })
        .then(({ response }) => {
          if (response === 1) {
            overlayWindow?.reload()
          }
        })
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // Required Electron cleanup — a missed unregister leaves the OS-level
  // hotkeys bound after the app exits, which then silently fails to
  // re-register them ("already in use by another application") on the next
  // launch until the OS itself releases them.
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
}
