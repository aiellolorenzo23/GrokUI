export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'emphasis'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'image'; alt: string; target: string }
  | { type: 'link'; value: string; target: string }
  | { type: 'markdown-link'; value: string; target: string }

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'rule' }
  | { type: 'code'; code: string; language: string }
  | { type: 'list'; ordered: boolean; items: Array<{ text: string; checked?: boolean }> }
  | { type: 'quote'; lines: string[] }
  | {
      type: 'table'
      headers: string[]
      alignments: Array<'left' | 'center' | 'right' | undefined>
      rows: string[][]
    }

function mergeAdjacentTextTokens(tokens: InlineToken[]): InlineToken[] {
  return tokens.reduce<InlineToken[]>((merged, token) => {
    const previous = merged.at(-1)
    if (token.type === 'text' && previous?.type === 'text') {
      previous.value += token.value
      return merged
    }

    merged.push(token)
    return merged
  }, [])
}

export function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\`*_~{}[\]()#+\-.!|>])/g, '$1')
}

export function parseLinkTokens(segment: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern =
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<((?:file:\/\/\/|https?:\/\/)[^>]+)>|(?:file:\/\/\/[^\s)]+|https?:\/\/[^\s)]+|[A-Za-z]:\\(?:[^<>:"/\\|?*\n\s[()]+\\)*[^<>:"/\\|?*\n\s[\](),;:]+)/g
  let lastIndex = 0

  for (const match of segment.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: segment.slice(lastIndex, index) })
    }

    const rawTarget = match[0]
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({
        type: 'image',
        alt: match[1],
        target: match[2]
      })
    } else if (match[3] && match[4]) {
      tokens.push({
        type: 'markdown-link',
        value: match[3],
        target: match[4]
      })
    } else {
      const autolinkTarget = match[5]
      const target = (autolinkTarget ?? rawTarget).replace(/[),.;]+$/g, '')
      const trailing = autolinkTarget ? '' : rawTarget.slice(target.length)
      tokens.push({ type: 'link', value: target, target })
      if (trailing) tokens.push({ type: 'text', value: trailing })
    }
    lastIndex = index + rawTarget.length
  }

  if (lastIndex < segment.length) {
    tokens.push({ type: 'text', value: segment.slice(lastIndex) })
  }

  return tokens.length > 0 ? mergeAdjacentTextTokens(tokens) : [{ type: 'text', value: segment }]
}

export function parseStyledSegment(segment: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*\n]+)\*|_([^_\n]+)_)/g
  let lastIndex = 0

  for (const match of segment.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push(...parseLinkTokens(segment.slice(lastIndex, index)))
    }

    if (match[2] || match[3]) {
      const value = match[2] ?? match[3]
      tokens.push({ type: 'strong', value: match[2] })
      tokens[tokens.length - 1] = { type: 'strong', value }
    } else if (match[4]) {
      tokens.push({ type: 'strike', value: match[4] })
    } else {
      tokens.push({ type: 'emphasis', value: match[5] ?? match[6] })
    }
    lastIndex = index + match[0].length
  }

  if (lastIndex < segment.length) {
    tokens.push(...parseLinkTokens(segment.slice(lastIndex)))
  }

  return tokens.length > 0 ? mergeAdjacentTextTokens(tokens) : [{ type: 'text', value: segment }]
}

export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /`([^`]+)`/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push(...parseStyledSegment(text.slice(lastIndex, index)))
    }

    tokens.push({ type: 'code', value: match[1] })
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push(...parseStyledSegment(text.slice(lastIndex)))
  }

  return tokens.length > 0 ? mergeAdjacentTextTokens(tokens) : [{ type: 'text', value: text }]
}

export function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.includes('|') && trimmed.split('|').length >= 2
}

export function isTableSeparator(line: string): boolean {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim())
}

export function parseTableAlignments(line: string): Array<'left' | 'center' | 'right' | undefined> {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => {
      const trimmed = cell.trim()
      const starts = trimmed.startsWith(':')
      const ends = trimmed.endsWith(':')
      if (starts && ends) return 'center'
      if (ends) return 'right'
      if (starts) return 'left'
      return undefined
    })
}

export function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      })
      index += 1
      continue
    }

    const setextHeadingMatch =
      index + 1 < lines.length ? lines[index + 1].trim().match(/^(=+|-+)\s*$/) : null
    if (setextHeadingMatch && trimmed) {
      blocks.push({
        type: 'heading',
        level: setextHeadingMatch[1].startsWith('=') ? 1 : 2,
        text: trimmed
      })
      index += 2
      continue
    }

    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    const fenceMatch = trimmed.match(/^(```+|~~~+)\s*(.*)$/)
    if (fenceMatch) {
      const fence = fenceMatch[1]
      const language = fenceMatch[2].trim()
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) index += 1
      blocks.push({ type: 'code', code: codeLines.join('\n'), language })
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = []

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }

      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }

    if (index + 1 < lines.length && isTableLine(line) && isTableSeparator(lines[index + 1])) {
      const headers = parseTableRow(line)
      const alignments = parseTableAlignments(lines[index + 1])
      const rows: string[][] = []
      index += 2

      while (index < lines.length && isTableLine(lines[index])) {
        rows.push(parseTableRow(lines[index]))
        index += 1
      }

      blocks.push({ type: 'table', headers, alignments, rows })
      continue
    }

    if (/^([-*+])\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed)
      const items: Array<{ text: string; checked?: boolean }> = []

      while (index < lines.length) {
        const current = lines[index].trim()
        const matchesCurrent = ordered ? /^\d+[.)]\s+/.test(current) : /^([-*+])\s+/.test(current)
        const continuationLine = !matchesCurrent && /^\s{2,}\S/.test(lines[index])
        if (!matchesCurrent && !continuationLine) break

        if (continuationLine && items.length > 0) {
          items[items.length - 1].text += `\n${current}`
        } else {
          const listText = current.replace(ordered ? /^\d+[.)]\s+/ : /^([-*+])\s+/, '')
          const taskMatch = listText.match(/^\[( |x|X)\]\s+(.+)$/)
          if (taskMatch) {
            items.push({ text: taskMatch[2], checked: taskMatch[1].toLowerCase() === 'x' })
          } else {
            items.push({ text: listText })
          }
        }
        index += 1
      }

      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const current = lines[index]
      const currentTrimmed = current.trim()
      if (
        !currentTrimmed ||
        /^(#{1,6})\s+(.+)$/.test(currentTrimmed) ||
        (index + 1 < lines.length && /^(=+|-+)\s*$/.test(lines[index + 1].trim())) ||
        /^(?:---|\*\*\*|___)\s*$/.test(currentTrimmed) ||
        /^(```+|~~~+)/.test(currentTrimmed) ||
        (index + 1 < lines.length && isTableLine(current) && isTableSeparator(lines[index + 1])) ||
        /^>\s?/.test(currentTrimmed) ||
        /^([-*+])\s+/.test(currentTrimmed) ||
        /^\d+[.)]\s+/.test(currentTrimmed)
      ) {
        break
      }

      paragraphLines.push(current)
      index += 1
    }

    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
  }

  return blocks
}
