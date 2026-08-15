import { app, BrowserWindow } from 'electron'

export function applyStealth(win: BrowserWindow, hideFromScreenCapture: boolean): void {
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    })
    win.setAlwaysOnTop(true, 'pop-up-menu', 1)
    app.dock?.hide()
    win.setHiddenInMissionControl(true)
  } else if (process.platform === 'win32') {
    win.setSkipTaskbar(true)
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.setAppDetails({
      appId: 'SystemProcess',
      appIconPath: '',
      relaunchCommand: '',
      relaunchDisplayName: ''
    })
  }

  win.setContentProtection(hideFromScreenCapture)
  win.setIgnoreMouseEvents(false)
}
