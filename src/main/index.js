import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerNetworkIpc } from './ipc/network'
import { registerScriptIpc } from './ipc/scripts'

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // 禁用缓存以避免权限警告
      cache: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron')
  }

  registerNetworkIpc()
  registerScriptIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
