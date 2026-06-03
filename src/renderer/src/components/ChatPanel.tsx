import { useEffect, useState, type DragEvent, type FormEvent, type RefObject } from 'react'
import type { CliMode } from '../../../shared/types'
import type { AssistantViewMode, AttachedFile, ChatMessage, ConversationState } from '../appTypes'
import type { Dictionary } from '../i18n'
import { highlightCodeToHtml, normalizeHighlightLanguage } from '../utils/highlight'

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'link'; value: string; target: string }
  | { type: 'markdown-link'; value: string; target: string }

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; code: string; language: string }
  | { type: 'list'; ordered: boolean; items: Array<{ text: string; checked?: boolean }> }
  | { type: 'quote'; lines: string[] }
  | {
      type: 'table'
      headers: string[]
      alignments: Array<'left' | 'center' | 'right' | undefined>
      rows: string[][]
    }

function parseStyledSegment(segment: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /(\*\*([^*]+)\*\*)/g
  let lastIndex = 0

  for (const match of segment.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push(...parseLinkTokens(segment.slice(lastIndex, index)))
    }

    tokens.push({ type: 'strong', value: match[2] })
    lastIndex = index + match[0].length
  }

  if (lastIndex < segment.length) {
    tokens.push(...parseLinkTokens(segment.slice(lastIndex)))
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: segment }]
}

function parseLinkTokens(segment: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern =
    /\[([^\]]+)\]\(([^)\s]+)\)|(?:file:\/\/\/[^\s)]+|https?:\/\/[^\s)]+|[A-Za-z]:\\(?:[^<>:"/\\|?*\n]+\\)*[^<>:"/\\|?*\n]+)/g
  let lastIndex = 0

  for (const match of segment.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: segment.slice(lastIndex, index) })
    }

    const rawTarget = match[0]
    if (match[1] && match[2]) {
      tokens.push({
        type: 'markdown-link',
        value: match[1],
        target: match[2]
      })
    } else {
      const target = rawTarget.replace(/[),.;]+$/g, '')
      const trailing = rawTarget.slice(target.length)
      tokens.push({ type: 'link', value: target, target })
      if (trailing) tokens.push({ type: 'text', value: trailing })
    }
    lastIndex = index + rawTarget.length
  }

  if (lastIndex < segment.length) {
    tokens.push({ type: 'text', value: segment.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: segment }]
}

function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, '$1')
}

function parseInlineTokens(text: string): InlineToken[] {
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

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }]
}

function renderInlineContent(text: string): React.JSX.Element[] {
  return parseInlineTokens(unescapeMarkdownText(text)).map((token, index) =>
    token.type === 'code' ? (
      <code key={`${token.type}_${index}`}>{token.value}</code>
    ) : token.type === 'markdown-link' ? (
      <button
        key={`${token.type}_${index}`}
        type="button"
        className="message-inline-link"
        onClick={() => void window.api.openMedia(token.target)}
      >
        {token.value}
      </button>
    ) : token.type === 'link' ? (
      <button
        key={`${token.type}_${index}`}
        type="button"
        className="message-inline-link"
        onClick={() => void window.api.openMedia(token.target)}
      >
        {token.value}
      </button>
    ) : token.type === 'strong' ? (
      <strong key={`${token.type}_${index}`}>{token.value}</strong>
    ) : (
      <span key={`${token.type}_${index}`}>{token.value}</span>
    )
  )
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.includes('|') && trimmed.startsWith('|') && trimmed.endsWith('|')
}

function isTableSeparator(line: string): boolean {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim())
}

function parseTableAlignments(line: string): Array<'left' | 'center' | 'right' | undefined> {
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

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
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

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
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

    if (
      index + 1 < lines.length &&
      isTableLine(line) &&
      isTableSeparator(lines[index + 1])
    ) {
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

    if (/^([-*])\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: Array<{ text: string; checked?: boolean }> = []

      while (index < lines.length) {
        const current = lines[index].trim()
        const matchesCurrent = ordered ? /^\d+\.\s+/.test(current) : /^([-*])\s+/.test(current)
        if (!matchesCurrent) break

        const listText = current.replace(ordered ? /^\d+\.\s+/ : /^([-*])\s+/, '')
        const taskMatch = listText.match(/^\[( |x|X)\]\s+(.+)$/)
        if (taskMatch) {
          items.push({ text: taskMatch[2], checked: taskMatch[1].toLowerCase() === 'x' })
        } else {
          items.push({ text: listText })
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
        currentTrimmed.startsWith('```') ||
        (index + 1 < lines.length &&
          isTableLine(current) &&
          isTableSeparator(lines[index + 1])) ||
        /^>\s?/.test(currentTrimmed) ||
        /^([-*])\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed)
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

function CodeBlock({
  code,
  language,
  t,
  assistantViewMode
}: {
  code: string
  language: string
  t: Dictionary
  assistantViewMode: AssistantViewMode
}): React.JSX.Element {
  const [didCopy, setDidCopy] = useState(false)
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    void highlightCodeToHtml(code, normalizeHighlightLanguage(language), assistantViewMode).then(
      (result) => {
        if (!cancelled) setHtml(result)
      }
    )

    return () => {
      cancelled = true
    }
  }, [assistantViewMode, code, language])

  const copyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setDidCopy(true)
      window.setTimeout(() => setDidCopy(false), 1600)
    } catch {
      setDidCopy(false)
    }
  }

  return (
    <section className="message-code-block">
      <div className="message-code-toolbar">
        <div className="message-code-meta">
          <span className="message-code-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="message-code-language">{language || 'text'}</span>
        </div>
        <button className="message-code-copy" type="button" onClick={() => void copyCode()}>
          {didCopy ? t.copied : t.copyCode}
        </button>
      </div>
      <div className="shiki-shell" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}

function MessageContent({
  content,
  t,
  assistantViewMode
}: {
  content: string
  t: Dictionary
  assistantViewMode: AssistantViewMode
}): React.JSX.Element {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="message-content">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code_${index}`}
              code={block.code}
              language={block.language}
              t={t}
              assistantViewMode={assistantViewMode}
            />
          )
        }

        if (block.type === 'heading') {
          const HeadingTag = `h${Math.min(block.level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4'
          return <HeadingTag key={`heading_${index}`}>{renderInlineContent(block.text)}</HeadingTag>
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={`quote_${index}`} className="message-quote">
              {block.lines.map((line, lineIndex) => (
                <p key={`quote_line_${lineIndex}`}>{renderInlineContent(line)}</p>
              ))}
            </blockquote>
          )
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag key={`list_${index}`} className="message-list">
              {block.items.map((item, itemIndex) => (
                <li key={`item_${itemIndex}`} className={item.checked !== undefined ? 'task-item' : ''}>
                  {item.checked !== undefined && (
                    <input type="checkbox" checked={item.checked} readOnly tabIndex={-1} />
                  )}
                  <span>{renderInlineContent(item.text)}</span>
                </li>
              ))}
            </ListTag>
          )
        }

        if (block.type === 'table') {
          return (
            <div key={`table_${index}`} className="message-table-wrap">
              <table className="message-table">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`header_${headerIndex}`}
                        style={{ textAlign: block.alignments[headerIndex] ?? 'left' }}
                      >
                        {renderInlineContent(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`row_${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell_${rowIndex}_${cellIndex}`}
                          style={{ textAlign: block.alignments[cellIndex] ?? 'left' }}
                        >
                          {renderInlineContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return <p key={`paragraph_${index}`}>{renderInlineContent(block.text)}</p>
      })}
    </div>
  )
}

type ChatPanelProps = {
  t: Dictionary
  mode: CliMode
  isSidebarHidden: boolean
  showSidebar: () => void
  selectedSessionTitle: string
  activeConversation: ConversationState
  error?: string
  scrollerRef: RefObject<HTMLDivElement | null>
  updateScrollBottomVisibility: () => void
  showScrollBottom: boolean
  scrollToBottom: (behavior?: ScrollBehavior) => void
  renderMediaActions: (links: string[]) => React.JSX.Element | undefined
  assistantViewMode: AssistantViewMode
  messages: ChatMessage[]
  attachedFiles: AttachedFile[]
  removeAttachedFile: (path: string) => void
  prompt: string
  setPrompt: (value: string) => void
  sendPrompt: (event: FormEvent) => Promise<void>
  isSending: boolean
  selectFiles: () => Promise<void>
  isDraggingFile: boolean
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  refreshAllSessions: () => Promise<void>
  stopCurrent: () => Promise<void>
}

export function ChatPanel({
  t,
  mode,
  isSidebarHidden,
  showSidebar,
  selectedSessionTitle,
  activeConversation,
  error,
  scrollerRef,
  updateScrollBottomVisibility,
  showScrollBottom,
  scrollToBottom,
  renderMediaActions,
  assistantViewMode,
  messages,
  attachedFiles,
  removeAttachedFile,
  prompt,
  setPrompt,
  sendPrompt,
  isSending,
  selectFiles,
  isDraggingFile,
  onDragOver,
  onDragLeave,
  onDrop,
  refreshAllSessions,
  stopCurrent
}: ChatPanelProps): React.JSX.Element {
  return (
    <section
      className={
        isDraggingFile
          ? `chat-surface dragging-file assistant-view-${assistantViewMode}`
          : `chat-surface assistant-view-${assistantViewMode}`
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="chat-topbar">
        <div className="topbar-title">
          {isSidebarHidden && (
            <button
              className="sidebar-toggle-button show-menu-button"
              title={t.showMenu}
              aria-label={t.showMenu}
              onClick={showSidebar}
            >
              <span aria-hidden="true">›</span>
            </button>
          )}
          <div>
            <p>{mode === 'grok' ? t.grokCli : t.agentCli}</p>
            <h1>{selectedSessionTitle}</h1>
            <span className="topbar-subtitle">
              {mode === 'grok' ? t.grokModeDescription : t.agentModeDescription}
            </span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="share-button" onClick={() => void refreshAllSessions()}>
            {t.sync}
          </button>
          {activeConversation.activeRunId && (
            <button className="share-button danger" onClick={() => void stopCurrent()}>
              {t.stop}
            </button>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="conversation" ref={scrollerRef} onScroll={updateScrollBottomVisibility}>
        {activeConversation.messages.length === 0 && (
          <div className="empty-state">
            <h2>{mode === 'grok' ? t.talkToGrok : t.startAgent}</h2>
            <p>{t.emptyStateDescription}</p>
          </div>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === 'assistant'
                ? `chat-message ${message.role} ${assistantViewMode === 'cli' ? 'cli-like' : 'grokui-like'}`
                : `chat-message ${message.role}`
            }
          >
            <div className="message-author">
              {message.role === 'user' ? t.you : message.role === 'assistant' ? mode : t.system}
            </div>
            <MessageContent
              content={message.content}
              t={t}
              assistantViewMode={assistantViewMode}
            />
            {renderMediaActions([...(message.mediaLinks ?? []), ...(message.media ?? [])])}
          </article>
        ))}

        {activeConversation.activeRunId && (
          <article className="chat-message assistant pending">
            <div className="message-author">{mode}</div>
            <div className="typing-indicator" aria-label={t.responseInProgress}>
              <span />
              <span />
              <span />
            </div>
          </article>
        )}
      </div>

      {showScrollBottom && (
        <button
          className="scroll-bottom-button"
          type="button"
          title={t.scrollToLatest}
          onClick={() => scrollToBottom('smooth')}
        >
          &darr;
        </button>
      )}

      <div className="composer-stack">
        {attachedFiles.length > 0 && (
          <div className="attachment-tray">
            {attachedFiles.map((file) => (
              <button
                key={file.path}
                className="attachment-chip"
                type="button"
                title={file.path}
                onClick={() => removeAttachedFile(file.path)}
              >
                <span>{file.name}</span>
                <strong>x</strong>
              </button>
            ))}
          </div>
        )}
        <form className="composer" onSubmit={(event) => void sendPrompt(event)}>
          <button className="attach-button" type="button" title={t.attachFile} onClick={() => void selectFiles()}>
            +
          </button>
          <input
            value={prompt}
            placeholder={mode === 'grok' ? t.askGrokPlaceholder : t.agentTaskPlaceholder}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            className="voice-button"
            disabled={(!prompt.trim() && attachedFiles.length === 0) || isSending}
          >
            {isSending ? '...' : t.send}
          </button>
        </form>
      </div>

      {isDraggingFile && <div className="drop-hint">{t.dropHint}</div>}
    </section>
  )
}
