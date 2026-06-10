import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject
} from 'react'
import type { CliContextUsage, CliContextUsageSupport, CliMode } from '../../../shared/types'
import type { AssistantViewMode, AttachedFile, ChatMessage, ConversationState } from '../appTypes'
import type { Dictionary } from '../i18n'
import {
  getHighlightLanguageLabel,
  getPlainCodeHtml,
  highlightCodeToHtml,
  normalizeHighlightLanguage
} from '../utils/highlight'
import { parseInlineTokens, parseMarkdownBlocks, unescapeMarkdownText } from '../utils/markdown'
import {
  displayNameFromPath,
  extensionFromPath,
  mediaPreviewSrc,
  mediaTypeFromPath
} from '../utils/chat'

function renderGenericFileIcon(path: string): React.JSX.Element {
  const extension = extensionFromPath(path)

  if (['html', 'htm'].includes(extension)) {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m7.1 8.2 1.7 1.8-1.7 1.8M12.9 8.2 11.2 10l1.7 1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (extension === 'pdf') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.9 12.5V8.3h1.35c.85 0 1.4.45 1.4 1.14 0 .72-.55 1.16-1.4 1.16H7.9M10.8 12.5V8.3h1.05c1.22 0 1.95.77 1.95 2.08 0 1.33-.73 2.12-1.95 2.12H10.8ZM8 10.6h.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (['txt', 'md', 'doc', 'docx', 'rtf'].includes(extension)) {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 8.75h5.5M7 10.5h5.5M7 12.25h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1 8.6h5.8M7.1 11.2h5.8M9.3 8.6v5.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 7.9v1.1M10 9.8v1.1M10 11.7v1.1M9 13.5h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (
    ['js', 'ts', 'tsx', 'jsx', 'css', 'json', 'py', 'java', 'cpp', 'c', 'cs', 'php'].includes(
      extension
    )
  ) {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path
          d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m7.2 8.6-1.5 1.6 1.5 1.6M12.8 8.6l1.5 1.6-1.5 1.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path
        d="M4 3.75A1.75 1.75 0 0 1 5.75 2h5.28c.46 0 .9.18 1.22.5l2.25 2.25c.32.32.5.76.5 1.22v8.28A1.75 1.75 0 0 1 13.25 16H5.75A1.75 1.75 0 0 1 4 14.25V3.75Zm7 .25v2a1 1 0 0 0 1 1h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 12.1h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
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

function tableToMarkdown(
  headers: string[],
  alignments: Array<'left' | 'center' | 'right' | undefined>,
  rows: string[][]
): string {
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
  const [highlightedHtml, setHighlightedHtml] = useState<string>()
  const [wrapLines, setWrapLines] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const languageLabel = getHighlightLanguageLabel(language, code)
  const plainHtml = useMemo(() => getPlainCodeHtml(code), [code])
  const lineCount = useMemo(() => code.split('\n').length, [code])
  const isLongCodeBlock = lineCount > 22 || code.length > 2600
  const blockKey = `${assistantViewMode}::${language}::${code}`
  const html =
    highlightedHtml && highlightedHtml.startsWith(`<!--${blockKey}-->`)
      ? highlightedHtml.slice(blockKey.length + 7)
      : plainHtml

  useEffect(() => {
    let cancelled = false

    void highlightCodeToHtml(code, normalizeHighlightLanguage(language), assistantViewMode).then(
      (result) => {
        if (!cancelled) setHighlightedHtml(`<!--${blockKey}-->${result}`)
      }
    )

    return () => {
      cancelled = true
    }
  }, [assistantViewMode, blockKey, code, language])

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
          <button
            className="message-code-copy"
            type="button"
            onClick={() => setWrapLines((value) => !value)}
          >
            {wrapLines ? t.unwrapCode : t.wrapCode}
          </button>
          <button className="message-code-copy" type="button" onClick={() => void copyCode()}>
            {didCopy ? t.copied : t.copyCode}
          </button>
        </div>
      </div>
      <div
        className={
          wrapLines
            ? `shiki-shell wrapped${isLongCodeBlock && !isExpanded ? ' collapsed' : ''}`
            : `shiki-shell${isLongCodeBlock && !isExpanded ? ' collapsed' : ''}`
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isLongCodeBlock && (
        <div className="message-code-footer">
          <button
            className="message-code-copy"
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? t.collapseCode : t.expandCode(lineCount)}
          </button>
        </div>
      )}
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
                <th
                  key={`header_${headerIndex}`}
                  style={{ textAlign: alignments[headerIndex] ?? 'left' }}
                >
                  {renderInlineContent(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row_${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`cell_${rowIndex}_${cellIndex}`}
                    style={{ textAlign: alignments[cellIndex] ?? 'left' }}
                  >
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

function MessageMediaGallery({
  links,
  t
}: {
  links: string[]
  t: Dictionary
}): React.JSX.Element | null {
  const previewItems = Array.from(new Set(links))
    .map((link) => ({ link, mediaType: mediaTypeFromPath(link) }))
    .filter(
      (item) =>
        item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'file'
    )

  if (previewItems.length === 0) return null

  return (
    <div className="message-media-preview-grid">
      {previewItems.map((item) => (
        <div key={item.link} className="message-media-card">
          <button
            type="button"
            className="message-media-preview"
            title={t.viewMedia(item.mediaType)}
            onClick={() => void window.api.openMedia(item.link)}
          >
            {item.mediaType === 'image' ? (
              <img src={mediaPreviewSrc(item.link)} alt="" loading="lazy" />
            ) : item.mediaType === 'video' ? (
              <video src={mediaPreviewSrc(item.link)} muted playsInline preload="metadata" />
            ) : (
              <div className="message-media-file-fallback">
                <span className={`message-media-file-glyph ext-${extensionFromPath(item.link)}`}>
                  {renderGenericFileIcon(item.link)}
                </span>
                <strong>{displayNameFromPath(item.link)}</strong>
                <span className="message-media-file-extension">
                  {extensionFromPath(item.link) || 'file'}
                </span>
              </div>
            )}
          </button>
          <div className="message-media-card-actions">
            <div className="media-action-group">
              <button
                type="button"
                className="media-action icon-only"
                title={t.openContainingFolder}
                onClick={() => void window.api.openContainingFolder(item.link)}
              >
                <span className="media-action-icon folder" aria-hidden="true">
                  <svg viewBox="0 0 16 16" focusable="false">
                    <path
                      d="M1.75 4.25A1.25 1.25 0 0 1 3 3h3.1c.32 0 .62.13.84.36l.86.89h5.2a1.25 1.25 0 0 1 1.25 1.25v5.75A1.75 1.75 0 0 1 12.5 13H3.5a1.75 1.75 0 0 1-1.75-1.75V4.25Zm1.5-.25a.25.25 0 0 0-.25.25v.5h9.96a2.2 2.2 0 0 1 .29.02.25.25 0 0 0-.25-.27H7.38l-1.15-1.19a.18.18 0 0 0-.13-.06H3.25Zm10 1.75H2.75v5.5c0 .41.34.75.75.75h9c.41 0 .75-.34.75-.75v-5.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                className="media-action"
                onClick={() => void window.api.openMedia(item.link)}
              >
                <span className={`media-action-icon ${item.mediaType}`} aria-hidden="true">
                  {item.mediaType === 'video' ? (
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path
                        d="M3.2 2h8.6c.45 0 .84.3.95.73l.52 2.02H2.68l-.43-1.66A.9.9 0 0 1 3.2 2Zm10.2 3.75v6.95A1.3 1.3 0 0 1 12.1 14H3.9a1.3 1.3 0 0 1-1.3-1.3V5.75h10.8ZM6.4 8.05v2.6c0 .3.33.48.58.32l2.1-1.3a.38.38 0 0 0 0-.64l-2.1-1.3a.38.38 0 0 0-.58.32ZM4.05 2.9l1.55 1.15h1.52L5.54 2.9H4.05Zm3.67 0 1.56 1.15h1.51L9.21 2.9H7.72Z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : item.mediaType === 'image' ? (
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path
                        d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2Zm0 1a.5.5 0 0 0-.5.5v6.336l.782-.782a1 1 0 0 1 1.414 0L5.5 10.858l3.764-3.764a1 1 0 0 1 1.415 0L14 10.414V3.5a.5.5 0 0 0-.5-.5Zm7.25 2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path
                        d="M3 2.75A1.75 1.75 0 0 1 4.75 1h4.66c.46 0 .9.18 1.22.5l1.87 1.87c.32.32.5.76.5 1.22v6.66A1.75 1.75 0 0 1 11.25 13h-6.5A1.75 1.75 0 0 1 3 11.25v-8.5Zm5.5-.25v1.5a1 1 0 0 0 1 1H11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span>{t.viewMedia(item.mediaType)}</span>
              </button>
            </div>
          </div>
        </div>
      ))}
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
                <li
                  key={`item_${itemIndex}`}
                  className={item.checked !== undefined ? 'task-item' : ''}
                >
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

function ReasoningBlock({
  reasoning,
  defaultCollapsed,
  t
}: {
  reasoning: string
  defaultCollapsed?: boolean
  t: Dictionary
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)

  useEffect(() => {
    if (defaultCollapsed) setIsExpanded(false)
  }, [defaultCollapsed])

  return (
    <div className={`message-reasoning${isExpanded ? ' expanded' : ' collapsed'}`}>
      <button
        type="button"
        className="message-reasoning-toggle"
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span>{t.reasoning}</span>
        <strong>{isExpanded ? t.collapseReasoning : t.expandReasoning}</strong>
      </button>
      <div className="message-reasoning-body">
        <p>{reasoning}</p>
      </div>
    </div>
  )
}

function ContextUsageBadge({
  contextUsage,
  contextUsageSupport,
  t
}: {
  contextUsage?: CliContextUsage
  contextUsageSupport: CliContextUsageSupport
  t: Dictionary
}): React.JSX.Element {
  const boundedPercent = Math.max(0, Math.min(contextUsage?.percentage ?? 0, 100))
  const hasUsage = Boolean(contextUsage)
  const breakdown = contextUsage?.breakdown ?? []
  const isUnavailable = !hasUsage && contextUsageSupport !== 'unsupported'
  const badgePrimaryLabel = hasUsage ? contextUsage?.usedTokens : 'N/A'
  const badgeSecondaryLabel = hasUsage ? contextUsage?.totalTokens : t.context

  return (
    <div className="context-usage-anchor">
      <button
        type="button"
        className="context-usage-badge"
        aria-label={
          hasUsage
            ? `${t.context} ${contextUsage?.usedTokens} / ${contextUsage?.totalTokens} tokens (${contextUsage?.percentageLabel})`
            : t.contextUnavailable
        }
      >
        <span>{badgePrimaryLabel}</span>
        <span className="context-usage-divider">/</span>
        <span>{badgeSecondaryLabel}</span>
      </button>

      <div className="context-usage-popover" role="tooltip">
        <div className="context-usage-popover-header">
          <strong>{t.context}</strong>
          {hasUsage ? (
            <span>
              {contextUsage?.usedTokens} / {contextUsage?.totalTokens} tokens (
              {contextUsage?.percentageLabel})
            </span>
          ) : (
            <span>{t.contextUnavailable}</span>
          )}
        </div>

        {!hasUsage && <div className="context-usage-compact-note">{t.contextUnavailableHint}</div>}

        {contextUsage?.model && <div className="context-usage-model">{contextUsage.model}</div>}

        <div className={`context-usage-meter-row${hasUsage ? '' : ' empty'}`}>
          <div className="context-usage-meter" aria-hidden="true">
            <span style={{ width: `${boundedPercent}%` }} />
          </div>
          <strong>{hasUsage ? contextUsage?.percentageLabel : isUnavailable ? 'N/A' : '--'}</strong>
        </div>

        {breakdown.length > 0 && (
          <div className="context-usage-breakdown">
            {breakdown.map((entry) => (
              <div key={`${entry.label}_${entry.tokens}`} className="context-usage-breakdown-row">
                <span className={`context-usage-tone ${entry.tone}`}>{entry.label}</span>
                <span>{entry.tokens}</span>
                <span>{entry.percentage}</span>
                <span>{entry.extra ?? ''}</span>
              </div>
            ))}
          </div>
        )}

        {contextUsage?.compactNote && (
          <div className="context-usage-compact-note">{contextUsage.compactNote}</div>
        )}
      </div>
    </div>
  )
}

type ChatPanelProps = {
  t: Dictionary
  mode: CliMode
  isSidebarHidden: boolean
  logoStyle: CSSProperties
  showSidebar: () => void
  selectedSessionTitle: string
  activeConversation: ConversationState
  contextUsage?: CliContextUsage
  contextUsageSupport: CliContextUsageSupport
  error?: string
  scrollerRef: RefObject<HTMLDivElement | null>
  updateScrollBottomVisibility: () => void
  showScrollBottom: boolean
  scrollToBottom: (behavior?: ScrollBehavior) => void
  assistantViewMode: AssistantViewMode
  messages: ChatMessage[]
  attachedFiles: AttachedFile[]
  removeAttachedFile: (path: string) => void
  prompt: string
  setPrompt: (value: string) => void
  sendPrompt: (event: FormEvent) => Promise<void>
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
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
  logoStyle,
  showSidebar,
  selectedSessionTitle,
  activeConversation,
  contextUsage,
  contextUsageSupport,
  error,
  scrollerRef,
  updateScrollBottomVisibility,
  showScrollBottom,
  scrollToBottom,
  assistantViewMode,
  messages,
  attachedFiles,
  removeAttachedFile,
  prompt,
  setPrompt,
  sendPrompt,
  onComposerKeyDown,
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
  const hasLiveAssistantMessage =
    activeConversation.activeRunId &&
    activeConversation.messages[activeConversation.messages.length - 1]?.role === 'assistant'

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
      <header className={isSidebarHidden ? 'chat-topbar sidebar-hidden' : 'chat-topbar'}>
        <div className="topbar-title">
          <div className="topbar-sidebar-transition">
            <button
              className={
                isSidebarHidden
                  ? 'sidebar-toggle-button show-menu-button visible'
                  : 'sidebar-toggle-button show-menu-button'
              }
              title={t.showMenu}
              aria-label={t.showMenu}
              onClick={showSidebar}
            >
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <div
              className={isSidebarHidden ? 'topbar-hidden-brand visible' : 'topbar-hidden-brand'}
              style={logoStyle}
              aria-hidden={!isSidebarHidden}
            />
          </div>
          <div className={isSidebarHidden ? 'topbar-copy shifted' : 'topbar-copy'}>
            <p>{mode === 'grok' ? t.grokCli : t.agentCli}</p>
            <h1>{selectedSessionTitle}</h1>
            <span className="topbar-subtitle">
              {mode === 'grok' ? t.grokModeDescription : t.agentModeDescription}
            </span>
          </div>
        </div>
        <div className="topbar-actions">
          {(contextUsageSupport !== 'unsupported' || contextUsage) && (
            <ContextUsageBadge
              contextUsage={contextUsage}
              contextUsageSupport={contextUsageSupport}
              t={t}
            />
          )}
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

        {messages.map((message) => {
          const messageMedia = [...(message.mediaLinks ?? []), ...(message.media ?? [])]

          return (
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
              {message.reasoning && (
                <ReasoningBlock
                  reasoning={message.reasoning}
                  defaultCollapsed={message.reasoningCollapsed}
                  t={t}
                />
              )}
              {message.content.trim() && (
                <MessageContent
                  content={message.content}
                  t={t}
                  assistantViewMode={assistantViewMode}
                />
              )}
              <MessageMediaGallery links={messageMedia} t={t} />
            </article>
          )
        })}

        {activeConversation.activeRunId && !hasLiveAssistantMessage && (
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
          aria-label={t.scrollToLatest}
          onClick={() => scrollToBottom('smooth')}
        >
          <span className="scroll-bottom-button-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path
                d="M5.47 7.22a.75.75 0 0 1 1.06 0L10 10.69l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06Z"
                fill="currentColor"
              />
            </svg>
          </span>
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
          <button
            className="attach-button"
            type="button"
            title={t.attachFile}
            onClick={() => void selectFiles()}
          >
            +
          </button>
          <textarea
            value={prompt}
            rows={1}
            placeholder={mode === 'grok' ? t.askGrokPlaceholder : t.agentTaskPlaceholder}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onComposerKeyDown}
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
