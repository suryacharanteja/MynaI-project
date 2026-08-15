import { app, BrowserWindow } from 'electron'
import { createOverlayWindow } from './windows/overlay'
import { registerIpcHandlers } from './ipc'

let overlayWindow: BrowserWindow | null = null

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
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
