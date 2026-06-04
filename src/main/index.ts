import { app, shell, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { CliCapabilities } from '../shared/types'
import {
  exportSession,
  getSessionCwd,
  listModels,
  listSessionMedia,
  listSessions,
  startCliRun,
  stopCliRun
} from './cli'
import iconIco from '../../build/icon.ico?asset'
import icon from '../../resources/icon.png?asset'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'grokui-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

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

async function openContainingFolder(target: string): Promise<void> {
  if (/^https?:\/\//i.test(target)) {
    await shell.openExternal(target)
    return
  }

  const resolvedTarget = /^file:\/\//i.test(target) ? fileURLToPath(target) : target
  shell.showItemInFolder(resolvedTarget)
}

function mediaTypeForPath(target: string): 'image' | 'video' | 'file' {
  if (/\.(png|jpe?g|webp|gif)$/i.test(target)) return 'image'
  if (/\.(mp4|webm)$/i.test(target)) return 'video'
  return 'file'
}

function createFileAttachment(path: string): {
  path: string
  name: string
  mediaType: 'image' | 'video' | 'file'
} {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    mediaType: mediaTypeForPath(path)
  }
}

function prefsPath(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

async function readPreferences(): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(prefsPath(), 'utf-8')) as unknown
  } catch {
    return null
  }
}

async function writePreferences(value: unknown): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(prefsPath(), JSON.stringify(value, null, 2), 'utf-8')
}

function getSystemLocale(): string {
  return app.getPreferredSystemLanguages()[0] ?? app.getLocale()
}

function getHomeDir(): string {
  return app.getPath('home')
}

function getCliCapabilities(): CliCapabilities {
  // The current GrokUI integration uses headless `--output-format streaming-json`.
  // In this mode the local CLI does not expose the interactive Context/token panel.
  return {
    contextUsageSupport: 'unsupported'
  }
}

function contentTypeForPath(target: string): string {
  if (/\.(png)$/i.test(target)) return 'image/png'
  if (/\.(jpe?g)$/i.test(target)) return 'image/jpeg'
  if (/\.(webp)$/i.test(target)) return 'image/webp'
  if (/\.(gif)$/i.test(target)) return 'image/gif'
  if (/\.(mp4)$/i.test(target)) return 'video/mp4'
  if (/\.(webm)$/i.test(target)) return 'video/webm'
  return 'application/octet-stream'
}

function registerMediaProtocol(): void {
  protocol.handle('grokui-media', async (request) => {
    const url = new URL(request.url)
    const encodedPath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    const decodedTarget = decodeURIComponent(encodedPath)
    const filePath = /^file:\/\//i.test(decodedTarget)
      ? fileURLToPath(decodedTarget)
      : decodedTarget
    const fileBuffer = await readFile(filePath)

    return new Response(fileBuffer, {
      headers: {
        'content-type': contentTypeForPath(filePath),
        'cache-control': 'no-store'
      }
    })
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  app.setName('GrokUI')
  registerMediaProtocol()

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
  ipcMain.handle('cli:list-models', (_, cwd) => listModels(cwd))
  ipcMain.handle('cli:export-session', (_, mode, cwd, sessionId) =>
    exportSession(mode, cwd, sessionId)
  )
  ipcMain.handle('cli:get-session-cwd', (_, sessionId) => getSessionCwd(sessionId))
  ipcMain.handle('cli:list-session-media', (_, sessionId) => listSessionMedia(sessionId))
  ipcMain.handle('cli:start', (event, request) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No browser window available for CLI stream')
    return startCliRun(window, request)
  })
  ipcMain.handle('cli:stop', (_, runId) => stopCliRun(runId))
  ipcMain.handle('app:open-media', (_, target) => openMediaTarget(target))
  ipcMain.handle('app:open-containing-folder', (_, target) => openContainingFolder(target))
  ipcMain.handle('app:read-preferences', () => readPreferences())
  ipcMain.handle('app:write-preferences', (_, value) => writePreferences(value))
  ipcMain.handle('app:get-system-locale', () => getSystemLocale())
  ipcMain.handle('app:get-home-dir', () => getHomeDir())
  ipcMain.on('app:get-system-locale-sync', (event) => {
    event.returnValue = getSystemLocale()
  })
  ipcMain.on('app:get-home-dir-sync', (event) => {
    event.returnValue = getHomeDir()
  })
  ipcMain.on('app:get-cli-capabilities-sync', (event) => {
    event.returnValue = getCliCapabilities()
  })
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

    return result.canceled ? [] : result.filePaths.map(createFileAttachment)
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
