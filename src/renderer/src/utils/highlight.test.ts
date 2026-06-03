import { describe, expect, it } from 'vitest'
import { getPlainCodeHtml, highlightCodeToHtml, normalizeHighlightLanguage } from './highlight'

describe('normalizeHighlightLanguage', () => {
  it('maps common aliases to bundled shiki languages', () => {
    expect(normalizeHighlightLanguage('ts')).toBe('typescript')
    expect(normalizeHighlightLanguage('js')).toBe('javascript')
    expect(normalizeHighlightLanguage('py')).toBe('python')
    expect(normalizeHighlightLanguage('ps')).toBe('powershell')
    expect(normalizeHighlightLanguage('unknown')).toBe('text')
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
