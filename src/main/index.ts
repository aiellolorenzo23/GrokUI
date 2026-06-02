import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { exportSession, listSessionMedia, listSessions, startCliRun, stopCliRun } from './cli'
import iconIco from '../../build/icon.ico?asset'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    ...(process.platform === 'win32' ? { icon: iconIco } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function openMediaTarget(target: string): Promise<void> {
  if (/^https?:\/\//i.test(target)) {
    await shell.openExternal(target)
    return
  }

  if (/^file:\/\//i.test(target)) {
    await shell.openPath(fileURLToPath(target))
    return
  }

  await shell.openPath(target)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  app.setName('GrokUI')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.lollo.grokui')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  ipcMain.handle('cli:list-sessions', (_, mode, cwd, limit) => listSessions(mode, cwd, limit))
  ipcMain.handle('cli:export-session', (_, mode, cwd, sessionId) =>
    exportSession(mode, cwd, sessionId)
  )
  ipcMain.handle('cli:list-session-media', (_, sessionId) => listSessionMedia(sessionId))
  ipcMain.handle('cli:start', (event, request) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No browser window available for CLI stream')
    return startCliRun(window, request)
  })
  ipcMain.handle('cli:stop', (_, runId) => stopCliRun(runId))
  ipcMain.handle('app:open-media', (_, target) => openMediaTarget(target))
  ipcMain.handle('app:select-files', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] },
        { name: 'All files', extensions: ['*'] }
      ]
    }

    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    return result.canceled ? [] : result.filePaths
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
