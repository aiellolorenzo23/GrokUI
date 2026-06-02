import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CliMode, CliRunRequest, CliStreamEvent } from '../shared/types'

// Custom APIs for renderer
const api = {
  listSessions: (mode: CliMode, cwd: string, limit?: number) =>
    ipcRenderer.invoke('cli:list-sessions', mode, cwd, limit),
  exportSession: (mode: CliMode, cwd: string, sessionId: string) =>
    ipcRenderer.invoke('cli:export-session', mode, cwd, sessionId),
  listSessionMedia: (sessionId: string) => ipcRenderer.invoke('cli:list-session-media', sessionId),
  startCli: (request: CliRunRequest) => ipcRenderer.invoke('cli:start', request),
  stopCli: (runId: string) => ipcRenderer.invoke('cli:stop', runId),
  openMedia: (target: string) => ipcRenderer.invoke('app:open-media', target),
  onCliStream: (callback: (event: CliStreamEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: CliStreamEvent): void =>
      callback(payload)
    ipcRenderer.on('cli:stream', listener)
    return () => ipcRenderer.removeListener('cli:stream', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
