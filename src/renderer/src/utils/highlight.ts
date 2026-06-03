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
  'yaml',
  'yml',
  'html',
  'css',
  'diff',
  'markdown',
  'md'
] as const

type SupportedLanguage = (typeof supportedLanguages)[number]

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ['github-dark', 'nord'],
    langs: [...supportedLanguages]
  })

  return highlighterPromise
}

export function normalizeHighlightLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase().trim()
  if (!normalized) return 'text'
  if ((supportedLanguages as readonly string[]).includes(normalized)) {
    return normalized as SupportedLanguage
  }

  if (normalized === 'ts') return 'typescript'
  if (normalized === 'js') return 'javascript'
  if (normalized === 'py') return 'python'
  return 'text'
}

export async function highlightCodeToHtml(
  code: string,
  language: string,
  viewMode: 'grokui' | 'cli'
): Promise<string> {
  const highlighter = await getHighlighter()
  return highlighter.codeToHtml(code, {
    lang: normalizeHighlightLanguage(language) as BundledLanguage,
    theme: themeByViewMode[viewMode]
  })
}
