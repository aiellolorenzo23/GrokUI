import {
  type CSSProperties,
  type DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { CliMode, CliSession, CliStreamEvent } from '../../shared/types'
import grokLogo from '../../../resources/logo.svg'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  media?: string[]
}

type ConversationState = {
  messages: ChatMessage[]
  activeSessionId?: string
  activeRunId?: string
}

type SessionPrefs = {
  hidden: Record<CliMode, string[]>
  aliases: Record<string, string>
  agentSessionIds: string[]
}

type ContextMenuState = {
  mode: CliMode
  session: CliSession
  x: number
  y: number
}

type RenameState = {
  session: CliSession
  value: string
}

type AttachedFile = {
  path: string
  name: string
  mediaType: 'image' | 'video' | 'file'
}

const initialConversations: Record<CliMode, ConversationState> = {
  grok: { messages: [] },
  agent: { messages: [] }
}

const defaultCwd = 'C:\\Users\\lollo'
const prefsKey = 'grokui.sessionPrefs'

function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function getDefaultPrefs(): SessionPrefs {
  return {
    hidden: { grok: [], agent: [] },
    aliases: {},
    agentSessionIds: []
  }
}

function loadPrefs(): SessionPrefs {
  try {
    return { ...getDefaultPrefs(), ...JSON.parse(localStorage.getItem(prefsKey) ?? '{}') }
  } catch {
    return getDefaultPrefs()
  }
}

function normalizePrefs(value: unknown): SessionPrefs {
  const defaults = getDefaultPrefs()
  if (!value || typeof value !== 'object') return defaults

  const record = value as Partial<SessionPrefs>
  return {
    hidden: {
      grok: Array.isArray(record.hidden?.grok) ? record.hidden.grok : defaults.hidden.grok,
      agent: Array.isArray(record.hidden?.agent) ? record.hidden.agent : defaults.hidden.agent
    },
    aliases:
      record.aliases && typeof record.aliases === 'object' ? record.aliases : defaults.aliases,
    agentSessionIds: Array.isArray(record.agentSessionIds)
      ? record.agentSessionIds
      : defaults.agentSessionIds
  }
}

function sessionTitle(session: CliSession, aliases: Record<string, string>): string {
  return aliases[session.id] || session.summary || `(sessione ${shortId(session.id)})`
}

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop()?.toLowerCase() ?? path.toLowerCase()
}

function displayNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function extensionFromPath(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

function mediaTypeFromPath(path: string): AttachedFile['mediaType'] {
  const extension = extensionFromPath(path)
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return 'image'
  if (['mp4', 'webm'].includes(extension)) return 'video'
  return 'file'
}

function createAttachedFile(path: string): AttachedFile {
  const mediaType = mediaTypeFromPath(path)
  return {
    path,
    name: displayNameFromPath(path),
    mediaType
  }
}

function createDroppedFile(file: File): AttachedFile | undefined {
  const path = window.api.getFilePath(file)
  if (!path) return undefined

  const mediaType = mediaTypeFromPath(path)
  return {
    path,
    name: file.name || displayNameFromPath(path),
    mediaType
  }
}

function messageRoleFromHeading(heading: string): ChatMessage['role'] {
  if (heading.toLowerCase() === 'user') return 'user'
  if (heading.toLowerCase() === 'assistant') return 'assistant'
  return 'system'
}

function attachMediaToMessages(messages: ChatMessage[], media: string[]): ChatMessage[] {
  if (media.length === 0) return messages

  const assigned = new Set<string>()
  const nextMessages = messages.map((message) => {
    const content = message.content.toLowerCase()
    const matches = media.filter((item) => content.includes(filenameFromPath(item)))
    if (matches.length === 0) return message

    matches.forEach((item) => assigned.add(item))
    return { ...message, media: Array.from(new Set([...(message.media ?? []), ...matches])) }
  })

  const remaining = media.filter((item) => !assigned.has(item))
  if (remaining.length === 0) return nextMessages

  const lastAssistantIndex = nextMessages.findLastIndex((message) => message.role === 'assistant')
  if (lastAssistantIndex < 0) return nextMessages

  const target = nextMessages[lastAssistantIndex]
  nextMessages[lastAssistantIndex] = {
    ...target,
    media: Array.from(new Set([...(target.media ?? []), ...remaining]))
  }

  return nextMessages
}

function transcriptToMessages(transcript: string, media: string[] = []): ChatMessage[] {
  const trimmed = transcript.trim()
  if (!trimmed) return []

  const headingPattern = /^##\s+(User|Assistant|Tools|System)\s*$/gim
  const headings = Array.from(trimmed.matchAll(headingPattern))

  if (headings.length === 0) {
    return attachMediaToMessages(
      [
        {
          id: createId(),
          role: 'assistant',
          content: trimmed
        }
      ],
      media
    )
  }

  const messages = headings
    .map((heading, index) => {
      const start = (heading.index ?? 0) + heading[0].length
      const end = headings[index + 1]?.index ?? trimmed.length
      const content = trimmed.slice(start, end).trim()
      if (!content) return undefined

      return {
        id: createId(),
        role: messageRoleFromHeading(heading[1]),
        content
      }
    })
    .filter((message): message is ChatMessage => Boolean(message))

  return attachMediaToMessages(messages, media)
}

function normalizeMediaLink(link: string): string {
  return link.replace(/[),.;]+$/g, '')
}

function extractMediaLinks(text: string): string[] {
  const matches = text.match(
    /(?:file:\/\/\/[^\s)]+|[A-Za-z]:\\[^\n"']+\.(?:png|jpe?g|webp|gif|mp4|webm)|https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif|mp4|webm))/gi
  )

  return Array.from(new Set((matches ?? []).map(normalizeMediaLink)))
}

function appendMediaToLastAssistant(messages: ChatMessage[], media: string[]): ChatMessage[] {
  if (media.length === 0) return messages

  const lastAssistantIndex = messages.findLastIndex((message) => message.role === 'assistant')
  if (lastAssistantIndex < 0) return messages

  const nextMessages = [...messages]
  const target = nextMessages[lastAssistantIndex]
  nextMessages[lastAssistantIndex] = {
    ...target,
    media: Array.from(new Set([...(target.media ?? []), ...media]))
  }

  return nextMessages
}

function App(): React.JSX.Element {
  const [mode, setMode] = useState<CliMode>('grok')
  const [cwd, setCwd] = useState(defaultCwd)
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sessions, setSessions] = useState<Record<CliMode, CliSession[]>>({ grok: [], agent: [] })
  const [conversations, setConversations] =
    useState<Record<CliMode, ConversationState>>(initialConversations)
  const [prefs, setPrefs] = useState<SessionPrefs>(() => getDefaultPrefs())
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>()
  const [renameTarget, setRenameTarget] = useState<RenameState>()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sessionMediaRef = useRef<Record<string, string[]>>({})
  const prefsLoadedRef = useRef(false)
  const logoStyle = { '--logo': `url(${grokLogo})` } as CSSProperties
  const activeConversation = conversations[mode]

  const visibleSessions = useMemo(
    () => ({
      grok: sessions.grok.filter((session) => !prefs.hidden.grok.includes(session.id)),
      agent: sessions.agent.filter(
        (session) =>
          prefs.agentSessionIds.includes(session.id) && !prefs.hidden.agent.includes(session.id)
      )
    }),
    [prefs.agentSessionIds, prefs.hidden.agent, prefs.hidden.grok, sessions.agent, sessions.grok]
  )

  const selectedSession = useMemo(
    () =>
      visibleSessions[mode].find((session) => session.id === activeConversation.activeSessionId),
    [activeConversation.activeSessionId, mode, visibleSessions]
  )

  useEffect(() => {
    void window.api.readPreferences().then((storedPrefs) => {
      setPrefs(storedPrefs ? normalizePrefs(storedPrefs) : loadPrefs())
      prefsLoadedRef.current = true
    })
  }, [])

  useEffect(() => {
    if (!prefsLoadedRef.current) return
    void window.api.writePreferences(prefs)
  }, [prefs])

  const updateScrollBottomVisibility = (): void => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    setShowScrollBottom(distanceFromBottom > 180)
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'auto'): void => {
    const scroller = scrollerRef.current
    if (!scroller) return

    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior
    })
    setShowScrollBottom(false)
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeConversation.messages])

  useEffect(() => {
    return window.api.onCliStream((event: CliStreamEvent) => {
      if (event.kind === 'json') {
        const data = event.data as Record<string, unknown> | undefined
        const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : undefined

        if (data?.type === 'end' && sessionId) {
          setConversations((current) => {
            const target = current[event.mode]
            if (target.activeRunId !== event.runId) return current
            return {
              ...current,
              [event.mode]: { ...target, activeSessionId: sessionId }
            }
          })

          void window.api.listSessionMedia(sessionId).then((media) => {
            const previous = sessionMediaRef.current[sessionId] ?? []
            const newMedia = media.filter((item) => !previous.includes(item))

            if (newMedia.length > 0) {
              setConversations((conversationState) => {
                const target = conversationState[event.mode]
                return {
                  ...conversationState,
                  [event.mode]: {
                    ...target,
                    messages: appendMediaToLastAssistant(target.messages, newMedia)
                  }
                }
              })
            }

            sessionMediaRef.current = { ...sessionMediaRef.current, [sessionId]: media }
          })
        }

        return
      }

      setConversations((current) => {
        const target = current[event.mode]
        if (target.activeRunId !== event.runId) return current

        if (event.kind === 'text' || event.kind === 'stdout') {
          const chunk = event.text ?? ''
          const messages = [...target.messages]
          const last = messages[messages.length - 1]

          if (last?.role === 'assistant') {
            messages[messages.length - 1] = { ...last, content: `${last.content}${chunk}` }
          } else {
            messages.push({ id: createId(), role: 'assistant', content: chunk })
          }

          return { ...current, [event.mode]: { ...target, messages } }
        }

        if (event.kind === 'stderr' || event.kind === 'error') {
          return {
            ...current,
            [event.mode]: {
              ...target,
              messages: [
                ...target.messages,
                { id: createId(), role: 'system', content: event.text ?? 'Errore CLI' }
              ]
            }
          }
        }

        if (event.kind === 'exit') {
          setIsSending(false)
          const sessionId = target.activeSessionId
          if (sessionId) {
            void window.api.listSessionMedia(sessionId).then((media) => {
              sessionMediaRef.current = { ...sessionMediaRef.current, [sessionId]: media }
            })
          }
          return { ...current, [event.mode]: { ...target, activeRunId: undefined } }
        }

        return current
      })
    })
  }, [])

  const refreshSessions = async (targetMode: CliMode = mode): Promise<void> => {
    setIsLoadingSessions(true)
    setError(undefined)

    try {
      const nextSessions = await window.api.listSessions(targetMode, cwd, 50)
      setSessions((current) => ({ ...current, [targetMode]: nextSessions }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const refreshAllSessions = async (): Promise<void> => {
    setIsLoadingSessions(true)
    setError(undefined)

    try {
      const grokSessions = await window.api.listSessions('grok', cwd, 50)
      setSessions((current) => ({ ...current, grok: grokSessions, agent: current.agent }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setIsLoadingSessions(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshAllSessions()
    }, 0)
    return () => window.clearTimeout(timeoutId)
    // Initial import only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openSession = async (targetMode: CliMode, session: CliSession): Promise<void> => {
    setMode(targetMode)
    setError(undefined)

    try {
      const transcript = await window.api.exportSession(targetMode, cwd, session.id)
      const media = await window.api.listSessionMedia(session.id)
      setConversations((current) => ({
        ...current,
        [targetMode]: {
          messages: transcriptToMessages(transcript, media),
          activeSessionId: session.id,
          activeRunId: undefined
        }
      }))
      sessionMediaRef.current = { ...sessionMediaRef.current, [session.id]: media }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const startNew = (): void => {
    setConversations((current) => ({
      ...current,
      [mode]: { messages: [] }
    }))
    setPrompt('')
  }

  const stopCurrent = async (): Promise<void> => {
    const runId = activeConversation.activeRunId
    if (!runId) return
    await window.api.stopCli(runId)
    setIsSending(false)
  }

  const addAttachedFiles = (nextFiles: AttachedFile[]): void => {
    if (nextFiles.length === 0) return

    setAttachedFiles((current) =>
      Array.from(new Map([...current, ...nextFiles].map((file) => [file.path, file])).values())
    )
  }

  const addAttachedPaths = (paths: string[]): void => {
    addAttachedFiles(
      paths
        .map((path) => path.trim())
        .filter(Boolean)
        .map(createAttachedFile)
    )
  }

  const selectFiles = async (): Promise<void> => {
    const files = await window.api.selectFiles()
    addAttachedFiles(files)
  }

  const dropFiles = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault()
    setIsDraggingFile(false)

    const files = Array.from(event.dataTransfer.files)
      .map(createDroppedFile)
      .filter((file): file is AttachedFile => Boolean(file))

    addAttachedFiles(files)
  }

  const removeAttachedFile = (path: string): void => {
    setAttachedFiles((current) => current.filter((file) => file.path !== path))
  }

  const buildPrompt = (text: string): string => {
    if (attachedFiles.length === 0) return text

    const fileBlock = `File allegati:\n${attachedFiles.map((file) => file.path).join('\n')}`
    return text ? `${text}\n\n${fileBlock}` : fileBlock
  }

  const sendPrompt = async (event: FormEvent): Promise<void> => {
    event.preventDefault()

    const text = prompt.trim()
    if ((!text && attachedFiles.length === 0) || isSending) return

    const outgoingPrompt = buildPrompt(text)
    setPrompt('')
    setAttachedFiles([])
    setIsSending(true)
    setError(undefined)

    setConversations((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        messages: [
          ...current[mode].messages,
          { id: createId(), role: 'user', content: outgoingPrompt }
        ]
      }
    }))

    try {
      const started = await window.api.startCli({
        mode,
        cwd,
        prompt: outgoingPrompt,
        sessionId: activeConversation.activeSessionId,
        model
      })

      setConversations((current) => ({
        ...current,
        [mode]: { ...current[mode], activeRunId: started.runId }
      }))
    } catch (reason) {
      setIsSending(false)
      setPrompt(text)
      addAttachedPaths(attachedFiles.map((file) => file.path))
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const renameSession = (session: CliSession): void => {
    setContextMenu(undefined)
    setRenameTarget({ session, value: sessionTitle(session, prefs.aliases) })
  }

  const confirmRename = (): void => {
    if (!renameTarget?.value.trim()) return
    setPrefs((current) => ({
      ...current,
      aliases: { ...current.aliases, [renameTarget.session.id]: renameTarget.value.trim() }
    }))
    setRenameTarget(undefined)
  }

  const hideSession = (targetMode: CliMode, session: CliSession): void => {
    setPrefs((current) => ({
      ...current,
      hidden: {
        ...current.hidden,
        [targetMode]: Array.from(new Set([...current.hidden[targetMode], session.id]))
      }
    }))
    setContextMenu(undefined)
  }

  const moveToAgent = (session: CliSession): void => {
    setContextMenu(undefined)
    setSessions((current) => ({
      ...current,
      agent: Array.from(
        new Map([...current.agent, session].map((item) => [item.id, item])).values()
      )
    }))
    setPrefs((current) => ({
      ...current,
      agentSessionIds: Array.from(new Set([...current.agentSessionIds, session.id]))
    }))
  }

  const renderSession = (targetMode: CliMode, session: CliSession): React.JSX.Element => (
    <button
      key={session.id}
      className={
        mode === targetMode && activeConversation.activeSessionId === session.id
          ? 'history-item active'
          : 'history-item'
      }
      onClick={() => openSession(targetMode, session)}
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({ mode: targetMode, session, x: event.clientX, y: event.clientY })
      }}
    >
      <strong>{sessionTitle(session, prefs.aliases)}</strong>
      <span>
        {session.updated} - {session.status}
      </span>
    </button>
  )

  const renderMediaActions = (links: string[]): React.JSX.Element | undefined => {
    const uniqueLinks = Array.from(new Set(links))
    if (uniqueLinks.length === 0) return undefined

    return (
      <div className="media-actions">
        {uniqueLinks.map((link) => {
          const mediaType = mediaTypeFromPath(link)

          return (
            <button key={link} className="media-action" onClick={() => window.api.openMedia(link)}>
              <span>{mediaType === 'video' ? 'View Video' : 'View Image'}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <main className={isSidebarHidden ? 'grok-shell sidebar-collapsed' : 'grok-shell'}>
      {!isSidebarHidden && (
        <aside className="grok-sidebar">
          <div className="sidebar-head">
            <div className="brand-logo" style={logoStyle} aria-label="GrokUI" />
            <button
              className="collapse-button"
              aria-label="Nascondi menu"
              title="Nascondi menu"
              onClick={() => setIsSidebarHidden(true)}
            >
              &lt;&lt;
            </button>
          </div>

          <div className="mode-tabs" aria-label="Modalita">
            <button className={mode === 'grok' ? 'active' : ''} onClick={() => setMode('grok')}>
              Grok
            </button>
            <button className={mode === 'agent' ? 'active' : ''} onClick={() => setMode('agent')}>
              Agent
            </button>
          </div>

          <nav className="primary-nav" aria-label="Azioni">
            <button onClick={startNew}>
              <span className="nav-icon">+</span>
              Nuova Chat
            </button>
            <button onClick={() => refreshSessions()}>
              <span className="nav-icon">R</span>
              {isLoadingSessions ? 'Carico sessioni' : 'Aggiorna sessioni'}
            </button>
          </nav>

          <section className="settings-block">
            <label>
              Working directory
              <input value={cwd} onChange={(event) => setCwd(event.target.value)} />
            </label>
            <label>
              Modello
              <input
                value={model}
                placeholder="default CLI"
                onChange={(event) => setModel(event.target.value)}
              />
            </label>
          </section>

          <section className="history">
            <div className="section-row">
              <span>Grok</span>
              <button onClick={() => refreshSessions('grok')}>Aggiorna</button>
            </div>
            <div className="history-list">
              {visibleSessions.grok.map((session) => renderSession('grok', session))}
            </div>
          </section>

          <section className="history">
            <div className="section-row">
              <span>Agent</span>
              <button onClick={() => refreshSessions('agent')}>Aggiorna</button>
            </div>
            <div className="history-list">
              {visibleSessions.agent.length === 0 && (
                <p className="empty-list">Nessuna sessione Agent assegnata.</p>
              )}
              {visibleSessions.agent.map((session) => renderSession('agent', session))}
            </div>
          </section>

          <div className="account">
            <div className="avatar">L</div>
            <div>
              <strong>lorenzo_aiello</strong>
              <span>{cwd}</span>
            </div>
          </div>
        </aside>
      )}

      <section
        className={isDraggingFile ? 'chat-surface dragging-file' : 'chat-surface'}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDraggingFile(true)
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={dropFiles}
      >
        <header className="chat-topbar">
          <div className="topbar-title">
            {isSidebarHidden && (
              <button className="show-menu-button" onClick={() => setIsSidebarHidden(false)}>
                &gt;&gt;
              </button>
            )}
            <div>
              <p>{mode === 'grok' ? 'Grok CLI' : 'Agent CLI'}</p>
              <h1>
                {selectedSession
                  ? sessionTitle(selectedSession, prefs.aliases)
                  : 'Nuova conversazione'}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="share-button" onClick={() => refreshAllSessions()}>
              Sincronizza
            </button>
            {activeConversation.activeRunId && (
              <button className="share-button danger" onClick={stopCurrent}>
                Stop
              </button>
            )}
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="conversation" ref={scrollerRef} onScroll={updateScrollBottomVisibility}>
          {activeConversation.messages.length === 0 && (
            <div className="empty-state">
              <h2>{mode === 'grok' ? 'Parla con Grok' : 'Avvia Agent'}</h2>
              <p>
                Le risposte arrivano dal CLI locale, lanciato in background senza finestre terminale
                visibili.
              </p>
            </div>
          )}

          {activeConversation.messages.map((message) => (
            <article key={message.id} className={`chat-message ${message.role}`}>
              <div className="message-author">
                {message.role === 'user' ? 'Tu' : message.role === 'assistant' ? mode : 'Sistema'}
              </div>
              <pre>{message.content}</pre>
              {renderMediaActions([
                ...extractMediaLinks(message.content),
                ...(message.media ?? [])
              ])}
            </article>
          ))}

          {activeConversation.activeRunId && (
            <article className="chat-message assistant pending">
              <div className="message-author">{mode}</div>
              <div className="typing-indicator" aria-label="Risposta in corso">
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
            title="Vai all'ultimo messaggio"
            onClick={() => scrollToBottom('smooth')}
          >
            ↓
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
          <form className="composer" onSubmit={sendPrompt}>
            <button
              className="attach-button"
              type="button"
              title="Allega file"
              onClick={selectFiles}
            >
              +
            </button>
            <input
              value={prompt}
              placeholder={
                mode === 'grok' ? 'Chiedi qualsiasi cosa a Grok' : 'Dai un compito ad Agent'
              }
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              className="voice-button"
              disabled={(!prompt.trim() && attachedFiles.length === 0) || isSending}
            >
              {isSending ? '...' : 'Invia'}
            </button>
          </form>
        </div>

        {isDraggingFile && <div className="drop-hint">Rilascia per allegare il path</div>}
      </section>

      {contextMenu && (
        <div className="session-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => renameSession(contextMenu.session)}>Rinomina</button>
          {contextMenu.mode === 'grok' && (
            <button onClick={() => moveToAgent(contextMenu.session)}>Aggiungi ad Agent</button>
          )}
          <button onClick={() => hideSession(contextMenu.mode, contextMenu.session)}>
            Nascondi solo in app
          </button>
        </div>
      )}

      {renameTarget && (
        <div className="dialog-backdrop" onClick={() => setRenameTarget(undefined)}>
          <form
            className="rename-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              confirmRename()
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <label>
              Rinomina sessione
              <input
                value={renameTarget.value}
                autoFocus
                onChange={(event) =>
                  setRenameTarget((current) =>
                    current ? { ...current, value: event.target.value } : current
                  )
                }
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setRenameTarget(undefined)}>
                Annulla
              </button>
              <button type="submit">Salva</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

export default App
