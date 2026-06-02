import { BrowserWindow } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import type { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import type {
  CliMode,
  CliRunRequest,
  CliRunStarted,
  CliSession,
  CliStreamEvent
} from '../shared/types'

const running = new Map<string, ChildProcessWithoutNullStreams>()
const streamBuffers = new Map<string, { stdout: string; stderr: string }>()

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*m/g, '')
}

function commandFor(mode: CliMode): string {
  return mode === 'agent' ? 'agent' : 'grok'
}

function defaultCwd(cwd?: string): string {
  return cwd?.trim() || homedir()
}

function emit(window: BrowserWindow, event: CliStreamEvent): void {
  window.webContents.send('cli:stream', event)
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

function extractStreamingText(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : undefined

  if (type === 'text') {
    return typeof record.data === 'string' ? record.data : extractTextFromJson(record.data)
  }

  return undefined
}

function emitLine(
  window: BrowserWindow,
  runId: string,
  mode: CliMode,
  kind: 'stdout' | 'stderr',
  line: string
): void {
  if (!line.trim()) return

  if (kind === 'stdout') {
    try {
      const data = JSON.parse(line) as unknown
      const extracted = extractStreamingText(data)
      emit(window, { runId, mode, kind: 'json', data })
      if (extracted) emit(window, { runId, mode, kind: 'text', text: extracted })
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

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || stdout || `${commandFor(mode)} exited with code ${code}`))
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
  const args = [
    '--cwd',
    defaultCwd(request.cwd),
    '-p',
    request.prompt,
    '--output-format',
    'streaming-json'
  ]

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

  child.stdout.on('data', (chunk: Buffer) => {
    emitBufferedLines(window, runId, request.mode, 'stdout', chunk)
  })

  child.stderr.on('data', (chunk: Buffer) => {
    emitBufferedLines(window, runId, request.mode, 'stderr', chunk)
  })

  child.on('error', (error) => {
    running.delete(runId)
    emit(window, { runId, mode: request.mode, kind: 'error', text: error.message })
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
  return true
}
