import { BrowserWindow } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import type { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type {
  CliContextUsage,
  CliContextUsageEntry,
  CliModelsResponse,
  CliMode,
  CliRunRequest,
  CliRunStarted,
  CliSession,
  CliStreamEvent
} from '../shared/types'

const running = new Map<string, ChildProcessWithoutNullStreams>()
const streamBuffers = new Map<string, { stdout: string; stderr: string }>()
const contextBuffers = new Map<string, { active: boolean; lines: string[] }>()

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*m/g, '')
}

function commandFor(mode: CliMode): string {
  return mode === 'agent' ? 'agent' : 'grok'
}

function formatCliError(mode: CliMode, error: Error): string {
  const command = commandFor(mode)

  if ('code' in error && error.code === 'ENOENT') {
    return `Comando "${command}" non trovato. Verifica che Grok CLI sia installata e che "${command}" sia disponibile nel PATH.`
  }

  return error.message
}

function formatCliFailure(
  mode: CliMode,
  code: number | null,
  stderr: string,
  stdout: string
): string {
  const command = commandFor(mode)
  const output = (stderr || stdout).trim()

  if (/auth|login|token|credential/i.test(output)) {
    return `Grok CLI sembra richiedere login o credenziali aggiornate. Esegui "${command} login" da terminale e riprova.`
  }

  if (/permission|forbidden|unauthorized/i.test(output)) {
    return `Grok CLI ha rifiutato la richiesta per permessi o autorizzazione. Controlla login, piano e configurazione della CLI.`
  }

  if (/not found|not recognized|is not recognized/i.test(output)) {
    return `Comando "${command}" non disponibile. Verifica installazione e PATH della Grok CLI.`
  }

  return output || `${command} exited with code ${code}`
}

function defaultCwd(cwd?: string): string {
  return cwd?.trim() || homedir()
}

function emit(window: BrowserWindow, event: CliStreamEvent): void {
  window.webContents.send('cli:stream', event)
}

function toneForContextLabel(label: string): CliContextUsageEntry['tone'] {
  if (/tool/i.test(label)) return 'tools'
  if (/free/i.test(label)) return 'free'
  return 'used'
}

function parseContextUsage(lines: string[]): CliContextUsage | undefined {
  if (lines.length < 2) return undefined

  const summaryLine = lines.find((line) => /tokens\s*\(/i.test(line))
  if (!summaryLine) return undefined

  const summaryMatch = summaryLine.match(
    /([\d.]+\s*[kKmM]?)\s*\/\s*([\d.]+\s*[kKmM]?)\s*tokens\s*\(([\d.]+)%\)/i
  )
  if (!summaryMatch) return undefined

  const filteredLines = lines.map((line) => line.trim()).filter(Boolean)
  const modelLine = filteredLines.find(
    (line) =>
      !/tokens\s*\(/i.test(line) &&
      !/^[◆◇◈\s]+$/.test(line) &&
      !/^[◆◇◈]/.test(line) &&
      !/^Auto-compact\b/i.test(line)
  )

  const breakdown = filteredLines
    .filter((line) => /^[◆◇◈]/.test(line) && /\d/.test(line))
    .flatMap((line): CliContextUsageEntry[] => {
      const match = line.match(
        /^[◆◇◈]\s+(.+?)\s{2,}([\d.]+\s*[kKmM]?\s+tokens)\s{2,}\(([\d.]+%)\)(?:\s*[·•]\s*(.+))?$/
      )
      if (!match) return []

      return [
        {
          label: match[1].trim(),
          tokens: match[2].trim(),
          percentage: match[3].trim(),
          extra: match[4]?.trim(),
          tone: toneForContextLabel(match[1].trim())
        }
      ]
    })

  const compactNote = filteredLines.find((line) => /^Auto-compact\b/i.test(line))

  return {
    usedTokens: summaryMatch[1].replace(/\s+/g, ''),
    totalTokens: summaryMatch[2].replace(/\s+/g, ''),
    percentage: Number(summaryMatch[3]),
    percentageLabel: `${summaryMatch[3]}%`,
    model: modelLine,
    compactNote,
    breakdown
  }
}

function handleContextLine(
  window: BrowserWindow,
  runId: string,
  mode: CliMode,
  line: string
): boolean {
  const state = contextBuffers.get(runId) ?? { active: false, lines: [] }
  const trimmed = line.trim()

  if (!state.active && /^Context$/i.test(trimmed)) {
    contextBuffers.set(runId, { active: true, lines: [trimmed] })
    return true
  }

  if (!state.active) return false

  state.lines.push(trimmed)

  if (/^Auto-compact\b/i.test(trimmed)) {
    const parsed = parseContextUsage(state.lines)
    if (parsed) {
      emit(window, { runId, mode, kind: 'json', data: { type: 'context-usage', ...parsed } })
    }
    contextBuffers.delete(runId)
    return true
  }

  contextBuffers.set(runId, state)
  return true
}

function extractTextFromJson(data: unknown, depth = 0): string | undefined {
  if (depth > 8 || data == null) return undefined

  if (typeof data === 'string') {
    return data.trim() ? data : undefined
  }

  if (Array.isArray(data)) {
    const parts = data
      .map((item) => extractTextFromJson(item, depth + 1))
      .filter((item): item is string => Boolean(item))

    return parts.length > 0 ? parts.join('') : undefined
  }

  if (typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  const priorityFields = [
    'text',
    'content',
    'delta',
    'message',
    'output',
    'response',
    'markdown',
    'summary'
  ]

  for (const field of priorityFields) {
    const extracted = extractTextFromJson(record[field], depth + 1)
    if (extracted) return extracted
  }

  for (const [key, value] of Object.entries(record)) {
    if (priorityFields.includes(key)) continue
    const extracted = extractTextFromJson(value, depth + 1)
    if (extracted) return extracted
  }

  return undefined
}

function extractStreamingChunk(data: unknown): { kind: 'text' | 'thought'; text: string } | undefined {
  if (!data || typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : undefined

  if (type !== 'text' && type !== 'thought') return undefined

  const text = typeof record.data === 'string' ? record.data : extractTextFromJson(record.data)
  if (!text) return undefined

  return { kind: type, text }
}

function emitLine(
  window: BrowserWindow,
  runId: string,
  mode: CliMode,
  kind: 'stdout' | 'stderr',
  line: string
): void {
  if (!line.trim()) return

  if (handleContextLine(window, runId, mode, line)) return

  if (kind === 'stdout') {
    try {
      const data = JSON.parse(line) as unknown
      const extracted = extractStreamingChunk(data)
      emit(window, { runId, mode, kind: 'json', data })
      if (extracted) emit(window, { runId, mode, kind: extracted.kind, text: extracted.text })
      return
    } catch {
      // Plain output falls through to stdout text.
    }
  }

  emit(window, { runId, mode, kind, text: line })
}

function emitBufferedLines(
  window: BrowserWindow,
  runId: string,
  mode: CliMode,
  kind: 'stdout' | 'stderr',
  chunk: Buffer
): void {
  const buffers = streamBuffers.get(runId)
  if (!buffers) return

  const text = buffers[kind] + stripAnsi(chunk.toString('utf-8'))
  const lines = text.split(/\r?\n/)
  buffers[kind] = lines.pop() ?? ''

  for (const line of lines) {
    emitLine(window, runId, mode, kind, line)
  }
}

function flushStreamBuffer(window: BrowserWindow, runId: string, mode: CliMode): void {
  const buffers = streamBuffers.get(runId)
  if (!buffers) return

  emitLine(window, runId, mode, 'stdout', buffers.stdout)
  emitLine(window, runId, mode, 'stderr', buffers.stderr)
  streamBuffers.delete(runId)
  contextBuffers.delete(runId)
}

function runCli(args: string[], cwd: string, mode: CliMode): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandFor(mode), args, {
      cwd: defaultCwd(cwd),
      shell: false,
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += stripAnsi(chunk.toString('utf-8'))
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += stripAnsi(chunk.toString('utf-8'))
    })

    child.on('error', (error) => {
      reject(new Error(formatCliError(mode, error)))
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(formatCliFailure(mode, code, stderr, stdout)))
      }
    })
  })
}

export async function listSessions(mode: CliMode, cwd: string, limit = 50): Promise<CliSession[]> {
  const output = await runCli(['sessions', 'list', '--limit', String(limit)], cwd, mode)
  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('SESSION ID') && !line.startsWith('(no label)'))

  return rows
    .map((line) => {
      const match = line.match(
        /^([0-9a-f-]{36})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s+(.+)$/
      )

      if (!match) return undefined

      return {
        id: match[1],
        created: match[2],
        updated: match[3],
        status: match[4],
        summary: match[5]
      }
    })
    .filter((session): session is CliSession => Boolean(session))
}

export async function exportSession(
  mode: CliMode,
  cwd: string,
  sessionId: string
): Promise<string> {
  return runCli(['export', sessionId], cwd, mode)
}

export async function listModels(cwd: string): Promise<CliModelsResponse> {
  const output = await runCli(['models'], cwd, 'grok')
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const defaultLine = lines.find((line) => /^Default model:/i.test(line))
  const defaultModel = defaultLine?.replace(/^Default model:\s*/i, '').trim() || undefined
  const modelsStartIndex = lines.findIndex((line) => /^Available models:/i.test(line))
  const modelLines = modelsStartIndex >= 0 ? lines.slice(modelsStartIndex + 1) : []

  const models = modelLines
    .map((line) => {
      const match = line.match(/^([*-])\s+(.+?)(?:\s+\(default\))?$/i)
      if (!match) return undefined
      const id = match[2].trim()
      return {
        id,
        isDefault:
          match[1] === '*' ||
          /\(default\)\s*$/i.test(line) ||
          (defaultModel ? id === defaultModel : false)
      }
    })
    .filter((model): model is NonNullable<typeof model> => Boolean(model))

  return { defaultModel, models }
}

async function findSessionDirectory(
  root: string,
  sessionId: string,
  depth = 0
): Promise<string | undefined> {
  if (depth > 4) return undefined

  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return undefined
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = join(root, entry.name)
    if (entry.name === sessionId) return fullPath
    const found = await findSessionDirectory(fullPath, sessionId, depth + 1)
    if (found) return found
  }

  return undefined
}

function decodeSessionRootName(encodedRoot: string): string {
  const decoded = decodeURIComponent(encodedRoot)
  if (decoded.startsWith('\\\\?\\')) return decoded.slice(4)
  return decoded
}

export async function getSessionCwd(sessionId: string): Promise<string | undefined> {
  const sessionRoot = join(homedir(), '.grok', 'sessions')
  const sessionDirectory = await findSessionDirectory(sessionRoot, sessionId)
  if (!sessionDirectory) return undefined

  return decodeSessionRootName(dirname(sessionDirectory).split(/[\\/]/).pop() ?? '')
}

export async function listSessionMedia(sessionId: string): Promise<string[]> {
  const sessionRoot = join(homedir(), '.grok', 'sessions')
  const sessionDirectory = await findSessionDirectory(sessionRoot, sessionId)
  if (!sessionDirectory) return []

  const mediaDirectories = ['images', 'videos']
  const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm'])
  const media: string[] = []

  for (const directory of mediaDirectories) {
    const mediaDirectory = join(sessionDirectory, directory)
    let entries: Dirent[]

    try {
      entries = await readdir(mediaDirectory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue
      const extension = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
      if (extensions.has(extension)) media.push(join(mediaDirectory, entry.name))
    }
  }

  return media
}

export function startCliRun(window: BrowserWindow, request: CliRunRequest): CliRunStarted {
  const runId = randomUUID()
  const args = ['-p', request.prompt, '--output-format', 'streaming-json']

  if (request.model?.trim()) {
    args.unshift('-m', request.model.trim())
  }

  if (request.sessionId) {
    args.unshift('-r', request.sessionId)
  }

  const child = spawn(commandFor(request.mode), args, {
    cwd: defaultCwd(request.cwd),
    shell: false,
    windowsHide: true
  })

  running.set(runId, child)
  streamBuffers.set(runId, { stdout: '', stderr: '' })
  contextBuffers.set(runId, { active: false, lines: [] })

  child.stdout.on('data', (chunk: Buffer) => {
    emitBufferedLines(window, runId, request.mode, 'stdout', chunk)
  })

  child.stderr.on('data', (chunk: Buffer) => {
    emitBufferedLines(window, runId, request.mode, 'stderr', chunk)
  })

  child.on('error', (error) => {
    running.delete(runId)
    emit(window, {
      runId,
      mode: request.mode,
      kind: 'error',
      text: formatCliError(request.mode, error)
    })
  })

  child.on('close', (code) => {
    flushStreamBuffer(window, runId, request.mode)
    running.delete(runId)
    emit(window, { runId, mode: request.mode, kind: 'exit', code })
  })

  return { runId }
}

export function stopCliRun(runId: string): boolean {
  const child = running.get(runId)
  if (!child) return false
  child.kill()
  running.delete(runId)
  streamBuffers.delete(runId)
  contextBuffers.delete(runId)
  return true
}
