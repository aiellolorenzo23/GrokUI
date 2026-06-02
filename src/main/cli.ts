import { BrowserWindow } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import type {
  CliMode,
  CliRunRequest,
  CliRunStarted,
  CliSession,
  CliStreamEvent
} from '../shared/types'

const running = new Map<string, ChildProcessWithoutNullStreams>()

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

function extractTextFromJson(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  const directFields = ['text', 'content', 'delta', 'message']

  for (const field of directFields) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) return value
  }

  const nested = record.data
  if (nested && typeof nested === 'object') {
    return extractTextFromJson(nested)
  }

  return undefined
}

function emitLines(
  window: BrowserWindow,
  runId: string,
  mode: CliMode,
  kind: 'stdout' | 'stderr',
  chunk: Buffer
): void {
  const text = stripAnsi(chunk.toString('utf-8'))
  const lines = text.split(/\r?\n/).filter(Boolean)

  for (const line of lines) {
    if (kind === 'stdout') {
      try {
        const data = JSON.parse(line) as unknown
        const extracted = extractTextFromJson(data)
        emit(window, { runId, mode, kind: 'json', data })
        if (extracted) emit(window, { runId, mode, kind: 'text', text: extracted })
        continue
      } catch {
        // Plain output falls through to stdout text.
      }
    }

    emit(window, { runId, mode, kind, text: line })
  }
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

  child.stdout.on('data', (chunk: Buffer) => {
    emitLines(window, runId, request.mode, 'stdout', chunk)
  })

  child.stderr.on('data', (chunk: Buffer) => {
    emitLines(window, runId, request.mode, 'stderr', chunk)
  })

  child.on('error', (error) => {
    running.delete(runId)
    emit(window, { runId, mode: request.mode, kind: 'error', text: error.message })
  })

  child.on('close', (code) => {
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
  return true
}
