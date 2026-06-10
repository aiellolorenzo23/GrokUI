export type CliMode = 'grok' | 'agent'

export type CliSession = {
  id: string
  created: string
  updated: string
  status: string
  summary: string
}

export type CliContextUsageEntryTone = 'used' | 'tools' | 'free'

export type CliContextUsageEntry = {
  label: string
  tokens: string
  percentage: string
  extra?: string
  tone: CliContextUsageEntryTone
}

export type CliContextUsage = {
  usedTokens: string
  totalTokens: string
  percentage: number
  percentageLabel: string
  model?: string
  compactNote?: string
  breakdown: CliContextUsageEntry[]
}

export type CliContextUsageSupport = 'supported' | 'unsupported' | 'unknown'

export type CliCapabilities = {
  contextUsageSupport: CliContextUsageSupport
}

export type CliModelInfo = {
  id: string
  isDefault: boolean
}

export type CliModelsResponse = {
  defaultModel?: string
  models: CliModelInfo[]
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
  kind: 'stdout' | 'stderr' | 'text' | 'thought' | 'json' | 'exit' | 'error'
  text?: string
  data?: unknown
  code?: number | null
}
