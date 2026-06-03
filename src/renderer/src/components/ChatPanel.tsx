import { useState, type DragEvent, type FormEvent, type RefObject } from 'react'
import type { CliMode } from '../../../shared/types'
import type { AttachedFile, ChatMessage, ConversationState } from '../appTypes'
import type { Dictionary } from '../i18n'

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'code'; code: string; language: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }

function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /`([^`]+)`/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, index) })
    }

    tokens.push({ type: 'code', value: match[1] })
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }]
}

function renderInlineContent(text: string): React.JSX.Element[] {
  return parseInlineTokens(text).map((token, index) =>
    token.type === 'code' ? (
      <code key={`${token.type}_${index}`}>{token.value}</code>
    ) : (
      <span key={`${token.type}_${index}`}>{token.value}</span>
    )
  )
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

    if (/^([-*])\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []

      while (index < lines.length) {
        const current = lines[index].trim()
        const matchesCurrent = ordered ? /^\d+\.\s+/.test(current) : /^([-*])\s+/.test(current)
        if (!matchesCurrent) break

        items.push(current.replace(ordered ? /^\d+\.\s+/ : /^([-*])\s+/, ''))
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
        currentTrimmed.startsWith('```') ||
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
  t
}: {
  code: string
  language: string
  t: Dictionary
}): React.JSX.Element {
  const [didCopy, setDidCopy] = useState(false)

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
      <pre>
        <code>{code}</code>
      </pre>
    </section>
  )
}

function MessageContent({ content, t }: { content: string; t: Dictionary }): React.JSX.Element {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="message-content">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <CodeBlock key={`code_${index}`} code={block.code} language={block.language} t={t} />
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
                <li key={`item_${itemIndex}`}>{renderInlineContent(item)}</li>
              ))}
            </ListTag>
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
      className={isDraggingFile ? 'chat-surface dragging-file' : 'chat-surface'}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="chat-topbar">
        <div className="topbar-title">
          {isSidebarHidden && (
            <button className="show-menu-button" onClick={showSidebar}>
              &gt;&gt;
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
          <article key={message.id} className={`chat-message ${message.role}`}>
            <div className="message-author">
              {message.role === 'user' ? t.you : message.role === 'assistant' ? mode : t.system}
            </div>
            <MessageContent content={message.content} t={t} />
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
