export type CliMode = 'grok' | 'agent'

export type CliSession = {
  id: string
  created: string
  updated: string
  status: string
  summary: string
}

export type CliSettings = {
  cwd: string
  model: string
  outputFormat: 'plain' | 'streaming-json'
}

export type CliRunRequest = {
  mode: CliMode
  prompt: string
  cwd: string
  sessionId?: string
  model?: string
}

export type CliRunStarted = {
  runId: string
}

export type CliStreamEvent = {
  runId: string
  mode: CliMode
  kind: 'stdout' | 'stderr' | 'text' | 'json' | 'exit' | 'error'
  text?: string
  data?: unknown
  code?: number | null
}
