import { useEffect, useState, type DragEvent, type FormEvent, type RefObject } from 'react'
import type { CliMode } from '../../../shared/types'
import type { AssistantViewMode, AttachedFile, ChatMessage, ConversationState } from '../appTypes'
import type { Dictionary } from '../i18n'
import {
  getHighlightLanguageLabel,
  getPlainCodeHtml,
  highlightCodeToHtml,
  normalizeHighlightLanguage
} from '../utils/highlight'
import { parseInlineTokens, parseMarkdownBlocks, unescapeMarkdownText } from '../utils/markdown'

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
    ) : token.type === 'image' ? (
      <button
        key={`${token.type}_${index}`}
        type="button"
        className="message-inline-link message-inline-media"
        onClick={() => void window.api.openMedia(token.target)}
      >
        {token.alt || token.target}
      </button>
    ) : token.type === 'emphasis' ? (
      <em key={`${token.type}_${index}`}>{token.value}</em>
    ) : token.type === 'strike' ? (
      <del key={`${token.type}_${index}`}>{token.value}</del>
    ) : token.type === 'strong' ? (
      <strong key={`${token.type}_${index}`}>{token.value}</strong>
    ) : (
      <span key={`${token.type}_${index}`}>{token.value}</span>
    )
  )
}

function renderInlineLines(text: string): React.JSX.Element[] {
  return unescapeMarkdownText(text)
    .split('\n')
    .flatMap((line, lineIndex, lines) => {
      const content = renderInlineContent(line)
      if (lineIndex === lines.length - 1) return content
      return [...content, <br key={`br_${lineIndex}`} />]
    })
}

function tableToMarkdown(headers: string[], alignments: Array<'left' | 'center' | 'right' | undefined>, rows: string[][]): string {
  const separator = alignments.map((alignment) => {
    if (alignment === 'left') return ':---'
    if (alignment === 'right') return '---:'
    if (alignment === 'center') return ':---:'
    return '---'
  })

  return [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
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
  const [html, setHtml] = useState<string>(() => getPlainCodeHtml(code))
  const [wrapLines, setWrapLines] = useState(false)
  const languageLabel = getHighlightLanguageLabel(language, code)

  useEffect(() => {
    let cancelled = false
    setHtml(getPlainCodeHtml(code))

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
          <span className="message-code-language">{languageLabel}</span>
        </div>
        <div className="message-code-actions">
          <button className="message-code-copy" type="button" onClick={() => setWrapLines((value) => !value)}>
            {wrapLines ? t.unwrapCode : t.wrapCode}
          </button>
          <button className="message-code-copy" type="button" onClick={() => void copyCode()}>
            {didCopy ? t.copied : t.copyCode}
          </button>
        </div>
      </div>
      <div
        className={wrapLines ? 'shiki-shell wrapped' : 'shiki-shell'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

function TableBlock({
  headers,
  alignments,
  rows,
  t
}: {
  headers: string[]
  alignments: Array<'left' | 'center' | 'right' | undefined>
  rows: string[][]
  t: Dictionary
}): React.JSX.Element {
  const [didCopy, setDidCopy] = useState(false)

  const copyTable = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(tableToMarkdown(headers, alignments, rows))
      setDidCopy(true)
      window.setTimeout(() => setDidCopy(false), 1600)
    } catch {
      setDidCopy(false)
    }
  }

  return (
    <div className="message-table-block">
      <div className="message-table-actions">
        <button className="message-table-copy" type="button" onClick={() => void copyTable()}>
          {didCopy ? t.copied : t.copyTable}
        </button>
      </div>
      <div className="message-table-wrap">
        <table className="message-table">
          <thead>
            <tr>
              {headers.map((header, headerIndex) => (
                <th key={`header_${headerIndex}`} style={{ textAlign: alignments[headerIndex] ?? 'left' }}>
                  {renderInlineContent(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row_${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell_${rowIndex}_${cellIndex}`} style={{ textAlign: alignments[cellIndex] ?? 'left' }}>
                    {renderInlineContent(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
                <p key={`quote_line_${lineIndex}`}>{renderInlineLines(line)}</p>
              ))}
            </blockquote>
          )
        }

        if (block.type === 'rule') {
          return <hr key={`rule_${index}`} className="message-rule" />
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
                  <span>{renderInlineLines(item.text)}</span>
                </li>
              ))}
            </ListTag>
          )
        }

        if (block.type === 'table') {
          return (
            <TableBlock
              key={`table_${index}`}
              headers={block.headers}
              alignments={block.alignments}
              rows={block.rows}
              t={t}
            />
          )
        }

        return <p key={`paragraph_${index}`}>{renderInlineLines(block.text)}</p>
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
  const [copiedMessageId, setCopiedMessageId] = useState<string>()

  const copyMessage = async (message: ChatMessage): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? undefined : current))
      }, 1600)
    } catch {
      setCopiedMessageId(undefined)
    }
  }

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
              <span aria-hidden="true">&rsaquo;</span>
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
            <div className="message-toolbar">
              <button
                className="message-copy-button"
                type="button"
                onClick={() => void copyMessage(message)}
              >
                {copiedMessageId === message.id ? t.copied : t.copyMessage}
              </button>
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
