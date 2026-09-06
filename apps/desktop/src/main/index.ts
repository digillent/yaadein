import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { loadDesktopEnvFile } from './auth/loadEnv'
import { registerWorkingFolderIpc } from './ipc/workingFolderIpc'
import { registerMediaIpc } from './ipc/mediaIpc'
import { registerAuthIpc } from './ipc/authIpc'

loadDesktopEnvFile()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    title: 'Yaadein',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerAuthIpc()
  registerWorkingFolderIpc()
  registerMediaIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
