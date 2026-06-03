import { describe, expect, it } from 'vitest'
import {
  getHighlightLanguageLabel,
  getPlainCodeHtml,
  highlightCodeToHtml,
  inferHighlightLanguage,
  normalizeHighlightLanguage,
  resolveHighlightLanguage
} from './highlight'

describe('normalizeHighlightLanguage', () => {
  it('maps common aliases to bundled shiki languages', () => {
    expect(normalizeHighlightLanguage('ts')).toBe('typescript')
    expect(normalizeHighlightLanguage('js')).toBe('javascript')
    expect(normalizeHighlightLanguage('py')).toBe('python')
    expect(normalizeHighlightLanguage('ps')).toBe('powershell')
    expect(normalizeHighlightLanguage('mdx')).toBe('markdown')
    expect(normalizeHighlightLanguage('unknown')).toBe('text')
  })
})

describe('inferHighlightLanguage', () => {
  it('detects common unlabeled code blocks', () => {
    expect(inferHighlightLanguage('{\n  "ok": true\n}')).toBe('json')
    expect(inferHighlightLanguage('Get-ChildItem\n$env:FOO = "bar"')).toBe('powershell')
    expect(inferHighlightLanguage('FROM node:20\nRUN npm ci')).toBe('dockerfile')
    expect(inferHighlightLanguage('[tool.poetry]\nname = "app"')).toBe('toml')
    expect(inferHighlightLanguage('# title\n- item')).toBe('markdown')
  })
})

describe('resolveHighlightLanguage', () => {
  it('prefers explicit language tags over inference', () => {
    expect(resolveHighlightLanguage('bash', 'Get-ChildItem')).toBe('bash')
    expect(resolveHighlightLanguage('', 'Get-ChildItem')).toBe('powershell')
  })
})

describe('getHighlightLanguageLabel', () => {
  it('shows inferred languages when the fence is unlabeled', () => {
    expect(getHighlightLanguageLabel('', 'SELECT * FROM users')).toBe('sql')
    expect(getHighlightLanguageLabel('ts', 'const x: string = "ok"')).toBe('ts')
  })
})

describe('getPlainCodeHtml', () => {
  it('escapes html in fallback code markup', () => {
    expect(getPlainCodeHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe('highlightCodeToHtml', () => {
  it('returns highlighted html for inferred json code blocks', async () => {
    const html = await highlightCodeToHtml('{\n  "ok": true\n}', '', 'grokui')
    expect(html).toContain('shiki')
    expect(html).toContain('"ok"')
  })
})
