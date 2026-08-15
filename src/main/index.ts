import { app } from 'electron'
import { createOverlayWindow } from './windows/overlay'

app.whenReady().then(() => {
  createOverlayWindow({
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 360,
    minHeight: 240,
    hideFromScreenCapture: true,
    launchHidden: false
  })
})
