import { type CSSProperties, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { CliMode, CliSession, CliStreamEvent } from '../../shared/types'
import grokLogo from '../../../resources/logo.svg'
import { ChatPanel } from './components/ChatPanel'
import { RenameDialog } from './components/RenameDialog'
import { SessionContextMenu } from './components/SessionContextMenu'
import { Sidebar } from './components/Sidebar'
import { initialConversations, type AttachedFile, type ContextMenuState, type RenameState } from './appTypes'
import { useAppPreferences } from './hooks/useAppPreferences'
import { getDictionary } from './i18n'
import {
  appendMediaToLastAssistant,
  createAttachedFile,
  createChatMessage,
  createDroppedFile,
  sessionTitle,
  shortId,
  transcriptToMessages,
  mediaTypeFromPath
} from './utils/chat'

function mergeSessions(...groups: CliSession[][]): CliSession[] {
  return Array.from(new Map(groups.flat().map((session) => [session.id, session])).values())
}

function clampContextMenuPosition(x: number, y: number): { x: number; y: number } {
  const menuWidth = 188
  const menuHeight = 120
  const margin = 12

  return {
    x: Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin)),
    y: Math.max(margin, Math.min(y, window.innerHeight - menuHeight - margin))
  }
}

function App(): React.JSX.Element {
  const [locale, setLocale] = useState(() => window.api.bootstrap.systemLocale || navigator.language || 'en')
  const [mode, setMode] = useState<CliMode>('grok')
  const [cwd, setCwd] = useState(() => window.api.bootstrap.homeDir || '')
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sessions, setSessions] = useState<Record<CliMode, CliSession[]>>({ grok: [], agent: [] })
  const [conversations, setConversations] = useState(initialConversations)
  const [prefs, setPrefs] = useAppPreferences()
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>()
  const [renameTarget, setRenameTarget] = useState<RenameState>()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [loadingState, setLoadingState] = useState({ all: false, grok: false, agent: false })
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sessionMediaRef = useRef<Record<string, string[]>>({})
  const localeRef = useRef(locale)
  const initialRefreshDoneRef = useRef(false)
  const logoStyle = { '--logo': `url(${grokLogo})` } as CSSProperties
  const activeConversation = conversations[mode]
  const t = useMemo(() => getDictionary(locale), [locale])

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  const visibleSessions = useMemo(
    () => ({
      grok: sessions.grok.filter((session) => !prefs.hidden.grok.includes(session.id)),
      agent: sessions.agent.filter((session) => !prefs.hidden.agent.includes(session.id))
    }),
    [prefs.hidden.agent, prefs.hidden.grok, sessions.agent, sessions.grok]
  )

  const selectedSession = useMemo(
    () => visibleSessions[mode].find((session) => session.id === activeConversation.activeSessionId),
    [activeConversation.activeSessionId, mode, visibleSessions]
  )

  const isLoadingSessions = loadingState.all || loadingState.grok || loadingState.agent

  const setLoading = (key: 'all' | CliMode, value: boolean): void => {
    setLoadingState((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    void Promise.all([window.api.getSystemLocale(), window.api.getHomeDir()]).then(([systemLocale, homeDir]) => {
      if (systemLocale !== localeRef.current) setLocale(systemLocale)
      if (homeDir && homeDir !== cwd) setCwd(homeDir)
    })
  }, [])

  const refreshSessions = async (targetMode: CliMode = mode): Promise<void> => {
    setLoading(targetMode, true)
    setError(undefined)

    try {
      const nextSessions = await window.api.listSessions(targetMode, cwd, 50)

      if (targetMode === 'grok') {
        setSessions((current) => ({
          grok: nextSessions,
          agent: mergeSessions(
            current.agent.filter((session) => !prefs.agentSessionIds.includes(session.id)),
            current.agent.filter((session) => prefs.agentSessionIds.includes(session.id)),
            nextSessions.filter((session) => prefs.agentSessionIds.includes(session.id))
          )
        }))
      } else {
        setSessions((current) => ({
          ...current,
          agent: mergeSessions(
            nextSessions,
            current.grok.filter((session) => prefs.agentSessionIds.includes(session.id))
          )
        }))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(targetMode, false)
    }
  }

  const refreshAllSessions = async (): Promise<void> => {
    setLoading('all', true)
    setError(undefined)

    try {
      const [grokSessions, agentSessions] = await Promise.all([
        window.api.listSessions('grok', cwd, 50),
        window.api.listSessions('agent', cwd, 50)
      ])

      setSessions({
        grok: grokSessions,
        agent: mergeSessions(
          agentSessions,
          grokSessions.filter((session) => prefs.agentSessionIds.includes(session.id))
        )
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading('all', false)
    }
  }

  useEffect(() => {
    if (!cwd || initialRefreshDoneRef.current) return
    initialRefreshDoneRef.current = true
    void refreshAllSessions()
  }, [cwd])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.session-menu')) return
      setContextMenu(undefined)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setContextMenu(undefined)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const updateScrollBottomVisibility = (): void => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    setShowScrollBottom(distanceFromBottom > 180)
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'auto'): void => {
    const scroller = scrollerRef.current
    if (!scroller) return

    scroller.scrollTo({ top: scroller.scrollHeight, behavior })
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
            const nextContent = `${last.content}${chunk}`
            messages[messages.length - 1] = {
              ...createChatMessage('assistant', nextContent, { id: last.id, media: last.media }),
              media: last.media
            }
          } else {
            messages.push(createChatMessage('assistant', chunk))
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
                {
                  ...createChatMessage('system', event.text ?? getDictionary(localeRef.current).cliError)
                }
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

    const fileBlock = `${t.fileAttachmentsLabel}:\n${attachedFiles.map((file) => file.path).join('\n')}`
    return text ? `${text}\n\n${fileBlock}` : fileBlock
  }

  const sendPrompt = async (event: FormEvent): Promise<void> => {
    event.preventDefault()

    const text = prompt.trim()
    if ((!text && attachedFiles.length === 0) || isSending) return

    const currentFiles = attachedFiles
    const outgoingPrompt = buildPrompt(text)
    setPrompt('')
    setAttachedFiles([])
    setIsSending(true)
    setError(undefined)

    setConversations((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        messages: [...current[mode].messages, createChatMessage('user', outgoingPrompt)]
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
      addAttachedPaths(currentFiles.map((file) => file.path))
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const renameSession = (session: CliSession): void => {
    setContextMenu(undefined)
    setRenameTarget({
      session,
      value: sessionTitle(session, prefs.aliases, t.sessionFallback(shortId(session.id)))
    })
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
      agent: mergeSessions(current.agent, [session])
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
      onClick={() => void openSession(targetMode, session)}
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({ mode: targetMode, session, ...clampContextMenuPosition(event.clientX, event.clientY) })
      }}
    >
      <strong>{sessionTitle(session, prefs.aliases, t.sessionFallback(shortId(session.id)))}</strong>
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
            <button key={link} className="media-action" onClick={() => void window.api.openMedia(link)}>
              <span>{t.viewMedia(mediaType)}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const selectedSessionTitle = selectedSession
    ? sessionTitle(selectedSession, prefs.aliases, t.sessionFallback(shortId(selectedSession.id)))
    : t.newConversation

  return (
    <main className={isSidebarHidden ? 'grok-shell sidebar-collapsed' : 'grok-shell'}>
      <Sidebar
        isHidden={isSidebarHidden}
        logoStyle={logoStyle}
        t={t}
        mode={mode}
        setMode={setMode}
        startNew={startNew}
        refreshSessions={refreshSessions}
        isLoadingSessions={isLoadingSessions}
        cwd={cwd}
        setCwd={setCwd}
        model={model}
        setModel={setModel}
        visibleSessions={visibleSessions}
        renderSession={renderSession}
        onHide={() => setIsSidebarHidden(true)}
      />

      <ChatPanel
        t={t}
        mode={mode}
        isSidebarHidden={isSidebarHidden}
        showSidebar={() => setIsSidebarHidden(false)}
        selectedSessionTitle={selectedSessionTitle}
        activeConversation={activeConversation}
        error={error}
        scrollerRef={scrollerRef}
        updateScrollBottomVisibility={updateScrollBottomVisibility}
        showScrollBottom={showScrollBottom}
        scrollToBottom={scrollToBottom}
        renderMediaActions={renderMediaActions}
        messages={activeConversation.messages}
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
        prompt={prompt}
        setPrompt={setPrompt}
        sendPrompt={sendPrompt}
        isSending={isSending}
        selectFiles={selectFiles}
        isDraggingFile={isDraggingFile}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDraggingFile(true)
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={dropFiles}
        refreshAllSessions={refreshAllSessions}
        stopCurrent={stopCurrent}
      />

      {contextMenu && (
        <SessionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mode={contextMenu.mode}
          session={contextMenu.session}
          t={t}
          renameSession={renameSession}
          moveToAgent={moveToAgent}
          hideSession={hideSession}
        />
      )}

      {renameTarget && (
        <RenameDialog
          renameTarget={renameTarget}
          t={t}
          setRenameTarget={setRenameTarget}
          confirmRename={confirmRename}
          close={() => setRenameTarget(undefined)}
        />
      )}
    </main>
  )
}

export default App
