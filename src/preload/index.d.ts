import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  CliMode,
  CliRunRequest,
  CliRunStarted,
  CliSession,
  CliStreamEvent
} from '../shared/types'

type GrokUiApi = {
  listSessions: (mode: CliMode, cwd: string, limit?: number) => Promise<CliSession[]>
  exportSession: (mode: CliMode, cwd: string, sessionId: string) => Promise<string>
  listSessionMedia: (sessionId: string) => Promise<string[]>
  startCli: (request: CliRunRequest) => Promise<CliRunStarted>
  stopCli: (runId: string) => Promise<boolean>
  openMedia: (target: string) => Promise<void>
  onCliStream: (callback: (event: CliStreamEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GrokUiApi
  }
}
