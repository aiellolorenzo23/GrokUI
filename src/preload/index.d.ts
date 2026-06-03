import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  CliMode,
  CliRunRequest,
  CliRunStarted,
  CliSession,
  CliStreamEvent
} from '../shared/types'

type SelectedFile = {
  path: string
  name: string
  mediaType: 'image' | 'video' | 'file'
}

type GrokUiApi = {
  listSessions: (mode: CliMode, cwd: string, limit?: number) => Promise<CliSession[]>
  exportSession: (mode: CliMode, cwd: string, sessionId: string) => Promise<string>
  listSessionMedia: (sessionId: string) => Promise<string[]>
  startCli: (request: CliRunRequest) => Promise<CliRunStarted>
  stopCli: (runId: string) => Promise<boolean>
  openMedia: (target: string) => Promise<void>
  readPreferences: () => Promise<unknown | null>
  writePreferences: (value: unknown) => Promise<void>
  getSystemLocale: () => Promise<string>
  selectFiles: () => Promise<SelectedFile[]>
  getFilePath: (file: File) => string
  onCliStream: (callback: (event: CliStreamEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GrokUiApi
  }
}
