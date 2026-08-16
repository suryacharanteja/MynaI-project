import { app, BrowserWindow, dialog } from 'electron'
import { createOverlayWindow } from './windows/overlay'
import { registerIpcHandlers } from './ipc'

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
}
