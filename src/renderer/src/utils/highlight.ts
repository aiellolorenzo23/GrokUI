import { createHighlighter, type BundledLanguage, type BundledTheme } from 'shiki'

const themeByViewMode: Record<'grokui' | 'cli', BundledTheme> = {
  grokui: 'github-dark',
  cli: 'nord'
}

const supportedLanguages = [
  'text',
  'plaintext',
  'txt',
  'json',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'bash',
  'shell',
  'sh',
  'powershell',
  'ps1',
  'python',
  'java',
  'kotlin',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'sql',
  'yaml',
  'yml',
  'toml',
  'ini',
  'xml',
  'html',
  'css',
  'scss',
  'dockerfile',
  'diff',
  'markdown',
  'md'
] as const

type SupportedLanguage = (typeof supportedLanguages)[number]

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined
const highlightedHtmlCache = new Map<string, string>()

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ['github-dark', 'nord'],
    langs: [...supportedLanguages]
  })

  return highlighterPromise
}

const aliasMap: Record<string, SupportedLanguage> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  yml: 'yaml',
  ps: 'powershell',
  psm1: 'powershell',
  zsh: 'bash',
  console: 'bash',
  shellscript: 'bash',
  node: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  cs: 'csharp',
  rs: 'rust',
  golang: 'go',
  kt: 'kotlin',
  htm: 'html',
  svg: 'xml'
}

export function normalizeHighlightLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase().trim()
  if (!normalized) return 'text'
  if ((supportedLanguages as readonly string[]).includes(normalized)) {
    return normalized as SupportedLanguage
  }

  if (normalized in aliasMap) return aliasMap[normalized]
  return 'text'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function detectHighlightLanguage(code: string): SupportedLanguage {
  const trimmed = code.trim()
  if (!trimmed) return 'text'
  if (/^[\[{]/.test(trimmed) && /["'][^"']+["']\s*:/.test(trimmed)) return 'json'
  if (/^(diff|index\s+\w|\+\+\+|---|\@\@)/m.test(trimmed)) return 'diff'
  if (/^(FROM|RUN|CMD|COPY|ADD|WORKDIR|ENTRYPOINT|ENV)\b/m.test(trimmed)) return 'dockerfile'
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(trimmed)) return 'sql'
  if (/^(<!DOCTYPE|<html\b|<div\b|<svg\b|<\w+)/im.test(trimmed)) return 'html'
  if (/^(\s{0,2}[-\w]+:\s.+|\s*-\s+\w+)/m.test(trimmed)) return 'yaml'
  if (/^(\$ |PS [A-Z]:\\|npm |pnpm |yarn |git |cd |ls\b)/m.test(trimmed)) return 'bash'
  return 'text'
}

function resolveHighlightLanguage(language: string, code: string): SupportedLanguage {
  const normalized = normalizeHighlightLanguage(language)
  if (normalized !== 'text' || language.trim()) return normalized
  return detectHighlightLanguage(code)
}

export function getPlainCodeHtml(code: string): string {
  return `<pre class="shiki shiki-plain"><code>${escapeHtml(code)}</code></pre>`
}

export async function highlightCodeToHtml(
  code: string,
  language: string,
  viewMode: 'grokui' | 'cli'
): Promise<string> {
  const resolvedLanguage = resolveHighlightLanguage(language, code)
  const cacheKey = `${viewMode}::${resolvedLanguage}::${code}`
  const cached = highlightedHtmlCache.get(cacheKey)
  if (cached) return cached

  const highlighter = await getHighlighter()
  const html = highlighter.codeToHtml(code, {
    lang: resolvedLanguage as BundledLanguage,
    theme: themeByViewMode[viewMode]
  })
  highlightedHtmlCache.set(cacheKey, html)
  return html
}
