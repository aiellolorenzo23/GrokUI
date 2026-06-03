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
const cacheLimit = 120

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
  svg: 'xml',
  pwsh: 'powershell',
  psm: 'powershell',
  config: 'ini',
  env: 'ini',
  mkdown: 'markdown',
  mdx: 'markdown'
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

export function inferHighlightLanguage(code: string): SupportedLanguage {
  const trimmed = code.trim()
  if (!trimmed) return 'text'
  if (/^[\[{]/.test(trimmed) && /["'][^"']+["']\s*:/.test(trimmed)) return 'json'
  if (/^(diff|index\s+\w|\+\+\+|---|\@\@)/m.test(trimmed)) return 'diff'
  if (/^(FROM|RUN|CMD|COPY|ADD|WORKDIR|ENTRYPOINT|ENV)\b/m.test(trimmed)) return 'dockerfile'
  if (/^(version|services|volumes|networks)\s*:/m.test(trimmed)) return 'yaml'
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(trimmed)) return 'sql'
  if (/^(#{1,6}\s+.+|>\s+.+|[-*+]\s+.+|```|~~~)/m.test(trimmed)) return 'markdown'
  if (/^(Get-|Set-|New-|Remove-|Write-|Start-|Stop-|Test-|Import-|Export-|\$env:|param\s*\()/m.test(trimmed))
    return 'powershell'
  if (/^(#!\/.*\b(?:bash|sh|zsh)|\$ |npm |pnpm |yarn |git |cd |ls\b|echo\s+|cat\s+)/m.test(trimmed))
    return 'bash'
  if (/^\s*[A-Za-z0-9_.-]+\s*=\s*.+$/m.test(trimmed) && /^\s*\[[A-Za-z0-9_.-]+\]\s*$/m.test(trimmed))
    return 'toml'
  if (/^\[[^\]\n]+\]\s*$/.test(trimmed) || /^\s*[A-Za-z0-9_.-]+\s*=\s*.+$/m.test(trimmed)) return 'ini'
  if (/^\s*<\?xml\b|^\s*<(svg|rss|feed|\w+:[\w-]+)\b/im.test(trimmed)) return 'xml'
  if (/^(<!DOCTYPE|<html\b|<div\b|<svg\b|<\w+)/im.test(trimmed)) return 'html'
  if (/^(\s{0,2}[-\w]+:\s.+|\s*-\s+\w+)/m.test(trimmed)) return 'yaml'
  if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean|unknown|never|void)\b/.test(trimmed))
    return 'typescript'
  if (/\bimport\s+[\w{},*\s]+\s+from\s+['"]|export\s+(default|const|function|class)\b/.test(trimmed))
    return 'javascript'
  if (/^\s*(def|class)\s+\w+|^\s*from\s+\w+\s+import\s+|^\s*print\(/m.test(trimmed)) return 'python'
  return 'text'
}

export function resolveHighlightLanguage(language: string, code: string): SupportedLanguage {
  const normalized = normalizeHighlightLanguage(language)
  if (normalized !== 'text' || language.trim()) return normalized
  return inferHighlightLanguage(code)
}

export function getHighlightLanguageLabel(language: string, code: string): string {
  const resolved = resolveHighlightLanguage(language, code)
  if (language.trim()) return language.trim()
  if (resolved === 'plaintext' || resolved === 'txt') return 'text'
  return resolved
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

  try {
    const highlighter = await getHighlighter()
    const html = highlighter.codeToHtml(code, {
      lang: resolvedLanguage as BundledLanguage,
      theme: themeByViewMode[viewMode]
    })
    highlightedHtmlCache.set(cacheKey, html)
    if (highlightedHtmlCache.size > cacheLimit) {
      const oldestKey = highlightedHtmlCache.keys().next().value
      if (oldestKey) highlightedHtmlCache.delete(oldestKey)
    }
    return html
  } catch {
    return getPlainCodeHtml(code)
  }
}
