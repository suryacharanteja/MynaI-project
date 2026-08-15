import { join } from 'path'
import { BrowserWindow, screen } from 'electron'
import { applyStealth } from './stealth'

export interface OverlayWindowOptions {
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  hideFromScreenCapture: boolean
  initialOpacity?: number
  launchHidden: boolean
}

export function createOverlayWindow(options: OverlayWindowOptions): BrowserWindow {
  const { defaultWidth, defaultHeight, minWidth, minHeight, hideFromScreenCapture, launchHidden } = options
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const x = Math.floor((width - defaultWidth) / 2)
  const y = 40
  const windowOpacity = Number.isFinite(options.initialOpacity) ? (options.initialOpacity as number) : 1

  const overlay = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth,
    minHeight,
    maxWidth: width,
    maxHeight: height,
    x,
    y,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      backgroundThrottling: false,
      sandbox: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    show: false,
    opacity: windowOpacity,
    type: 'toolbar',
    acceptFirstMouse: false,
    disableAutoHideCursor: true,
    enableLargerThanScreen: false,
    hasShadow: false,
    thickFrame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000'
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlay.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    overlay.loadFile(join(__dirname, '../renderer/index.html'))
  }

  overlay.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  overlay.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })

  applyStealth(overlay, hideFromScreenCapture)

  overlay.webContents.on('did-finish-load', () => {
    if (!launchHidden) {
      overlay.showInactive()
    }
  })

  return overlay
}
