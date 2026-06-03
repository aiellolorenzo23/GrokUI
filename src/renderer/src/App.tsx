import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {
  CliCapabilities,
  CliContextUsage,
  CliMode,
  CliModelInfo,
  CliSession,
  CliStreamEvent
} from '../../shared/types'
import grokLogo from '../../../resources/logo.svg'
import { ChatPanel } from './components/ChatPanel'
import { RenameDialog } from './components/RenameDialog'
import { SessionContextMenu } from './components/SessionContextMenu'
import { Sidebar } from './components/Sidebar'
import {
  type AssistantViewMode,
  type AttachedFile,
  type ConversationState,
  type ContextMenuState,
  type RenameState
} from './appTypes'
import { useAppPreferences } from './hooks/useAppPreferences'
import { getDictionary } from './i18n'
import {
  appendMediaToLastAssistant,
  createAttachedFile,
  createChatMessage,
  createDroppedFile,
  sessionTitle,
  shortId,
  transcriptToMessages
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

function getDraftConversationKey(mode: CliMode): string {
  return `${mode}:draft`
}

function getSessionConversationKey(mode: CliMode, sessionId: string): string {
  return `${mode}:session:${sessionId}`
}

function createEmptyConversationState(): ConversationState {
  return { messages: [] }
}

function findConversationKeyByRunId(
  conversations: Record<string, ConversationState>,
  mode: CliMode,
  runId: string
): string | undefined {
  const prefix = `${mode}:`
  return Object.entries(conversations).find(
    ([key, conversation]) => key.startsWith(prefix) && conversation.activeRunId === runId
  )?.[0]
}

function App(): React.JSX.Element {
  const [locale, setLocale] = useState(
    () => window.api.bootstrap.systemLocale || navigator.language || 'en'
  )
  const [cliCapabilities] = useState<CliCapabilities>(() => window.api.bootstrap.cliCapabilities)
  const [mode, setMode] = useState<CliMode>('grok')
  const [cwd, setCwd] = useState(() => window.api.bootstrap.homeDir || '')
  const [model, setModel] = useState('')
  const [availableModels, setAvailableModels] = useState<CliModelInfo[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [sessions, setSessions] = useState<Record<CliMode, CliSession[]>>({ grok: [], agent: [] })
  const [conversations, setConversations] = useState<Record<string, ConversationState>>(() => ({
    [getDraftConversationKey('grok')]: createEmptyConversationState(),
    [getDraftConversationKey('agent')]: createEmptyConversationState()
  }))
  const [activeConversationKeys, setActiveConversationKeys] = useState<Record<CliMode, string>>({
    grok: getDraftConversationKey('grok'),
    agent: getDraftConversationKey('agent')
  })
  const [prefs, setPrefs] = useAppPreferences()
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>()
  const [renameTarget, setRenameTarget] = useState<RenameState>()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [loadingState, setLoadingState] = useState({ all: false, grok: false, agent: false })
  const [error, setError] = useState<string>()

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sessionMediaRef = useRef<Record<string, string[]>>({})
  const localeRef = useRef(locale)
  const initialRefreshDoneRef = useRef(false)
  const logoStyle = { '--logo': `url(${grokLogo})` } as CSSProperties
  const activeConversationKey = activeConversationKeys[mode]
  const activeConversation = conversations[activeConversationKey] ?? createEmptyConversationState()
  const t = useMemo(() => getDictionary(locale), [locale])

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    setModel((current) => (current === prefs.selectedModel ? current : prefs.selectedModel))
  }, [prefs.selectedModel])

  const visibleSessions = useMemo(
    () => ({
      grok: sessions.grok.filter((session) => !prefs.hidden.grok.includes(session.id)),
      agent: sessions.agent.filter((session) => !prefs.hidden.agent.includes(session.id))
    }),
    [prefs.hidden.agent, prefs.hidden.grok, sessions.agent, sessions.grok]
  )

  const selectedSession = useMemo(
    () =>
      visibleSessions[mode].find((session) => session.id === activeConversation.activeSessionId),
    [activeConversation.activeSessionId, mode, visibleSessions]
  )

  const isLoadingSessions = loadingState.all || loadingState.grok || loadingState.agent

  const setLoading = (key: 'all' | CliMode, value: boolean): void => {
    setLoadingState((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    void Promise.all([window.api.getSystemLocale(), window.api.getHomeDir()]).then(
      ([systemLocale, homeDir]) => {
        if (systemLocale !== localeRef.current) setLocale(systemLocale)
        if (homeDir) setCwd((current) => (homeDir !== current ? homeDir : current))
      }
    )
  }, [])

  useEffect(() => {
    if (!cwd) return

    let cancelled = false
    setIsLoadingModels(true)

    void window.api
      .listModels(cwd)
      .then((response) => {
        if (cancelled) return
        setAvailableModels(response.models)
      })
      .catch(() => {
        if (cancelled) return
        setAvailableModels([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModels(false)
      })

    return () => {
      cancelled = true
    }
  }, [cwd])

  const refreshSessions = useCallback(
    async (targetMode: CliMode = mode): Promise<void> => {
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
    },
    [cwd, mode, prefs.agentSessionIds]
  )

  const refreshAllSessions = useCallback(async (): Promise<void> => {
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
  }, [cwd, prefs.agentSessionIds])

  useEffect(() => {
    if (!cwd || initialRefreshDoneRef.current) return
    initialRefreshDoneRef.current = true
    void refreshAllSessions()
  }, [cwd, refreshAllSessions])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.session-menu')) return
      setContextMenu(undefined)
    }

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
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

        if (data?.type === 'context-usage') {
          setConversations((current) => {
            const key = findConversationKeyByRunId(current, event.mode, event.runId)
            if (!key) return current
            return {
              ...current,
              [key]: {
                ...current[key],
                contextUsage: data as unknown as CliContextUsage
              }
            }
          })
          return
        }

        if (data?.type === 'end' && sessionId) {
          setConversations((current) => {
            const key = findConversationKeyByRunId(current, event.mode, event.runId)
            if (!key) return current

            const target = current[key]
            const sessionKey = getSessionConversationKey(event.mode, sessionId)
            const nextConversation = { ...target, activeSessionId: sessionId }

            if (key === sessionKey) {
              return { ...current, [key]: nextConversation }
            }

            const nextState = {
              ...current,
              [sessionKey]: nextConversation
            }

            delete nextState[key]

            if (!nextState[getDraftConversationKey(event.mode)]) {
              nextState[getDraftConversationKey(event.mode)] = createEmptyConversationState()
            }

            return nextState
          })

          setActiveConversationKeys((current) => {
            const key = findConversationKeyByRunId(conversations, event.mode, event.runId)
            if (!key || current[event.mode] !== key) return current
            return {
              ...current,
              [event.mode]: getSessionConversationKey(event.mode, sessionId)
            }
          })

          void window.api.listSessionMedia(sessionId).then((media) => {
            const previous = sessionMediaRef.current[sessionId] ?? []
            const newMedia = media.filter((item) => !previous.includes(item))

            if (newMedia.length > 0) {
              setConversations((conversationState) => {
                const key =
                  conversationState[getSessionConversationKey(event.mode, sessionId)]
                    ? getSessionConversationKey(event.mode, sessionId)
                    : findConversationKeyByRunId(conversationState, event.mode, event.runId)
                if (!key) return conversationState
                const target = conversationState[key]
                return {
                  ...conversationState,
                  [key]: {
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
        const key = findConversationKeyByRunId(current, event.mode, event.runId)
        if (!key) return current
        const target = current[key]

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

          return { ...current, [key]: { ...target, messages } }
        }

        if (event.kind === 'stderr' || event.kind === 'error') {
          return {
            ...current,
            [key]: {
              ...target,
              messages: [
                ...target.messages,
                {
                  ...createChatMessage(
                    'system',
                    event.text ?? getDictionary(localeRef.current).cliError
                  )
                }
              ]
            }
          }
        }

        if (event.kind === 'exit') {
          const sessionId = target.activeSessionId
          if (sessionId) {
            void window.api.listSessionMedia(sessionId).then((media) => {
              sessionMediaRef.current = { ...sessionMediaRef.current, [sessionId]: media }
            })
          }
          return { ...current, [key]: { ...target, activeRunId: undefined } }
        }

        return current
      })
    })
  }, [])

  const openSession = async (targetMode: CliMode, session: CliSession): Promise<void> => {
    setMode(targetMode)
    setError(undefined)
    const conversationKey = getSessionConversationKey(targetMode, session.id)
    setActiveConversationKeys((current) => ({ ...current, [targetMode]: conversationKey }))

    try {
      const transcript = await window.api.exportSession(targetMode, cwd, session.id)
      const media = await window.api.listSessionMedia(session.id)
      setConversations((current) => ({
        ...current,
        [conversationKey]:
          current[conversationKey]?.activeRunId
            ? { ...current[conversationKey], activeSessionId: session.id }
            : {
                messages: transcriptToMessages(transcript, media),
                activeSessionId: session.id,
                activeRunId: undefined,
                contextUsage: current[conversationKey]?.contextUsage
              }
      }))
      sessionMediaRef.current = { ...sessionMediaRef.current, [session.id]: media }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const startNew = (): void => {
    const draftKey = getDraftConversationKey(mode)
    setConversations((current) => ({
      ...current,
      [draftKey]: createEmptyConversationState()
    }))
    setActiveConversationKeys((current) => ({ ...current, [mode]: draftKey }))
    setPrompt('')
  }

  const stopCurrent = async (): Promise<void> => {
    const runId = activeConversation.activeRunId
    if (!runId) return
    await window.api.stopCli(runId)
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
    if ((!text && attachedFiles.length === 0) || activeConversation.activeRunId) return

    const currentFiles = attachedFiles
    const outgoingPrompt = buildPrompt(text)
    setPrompt('')
    setAttachedFiles([])
    setError(undefined)

    setConversations((current) => ({
      ...current,
      [activeConversationKey]: {
        ...(current[activeConversationKey] ?? createEmptyConversationState()),
        messages: [
          ...(current[activeConversationKey]?.messages ?? []),
          createChatMessage('user', outgoingPrompt)
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
        [activeConversationKey]: {
          ...(current[activeConversationKey] ?? createEmptyConversationState()),
          activeRunId: started.runId
        }
      }))
    } catch (reason) {
      setPrompt(text)
      addAttachedPaths(currentFiles.map((file) => file.path))
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void sendPrompt(event)
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
        setContextMenu({
          mode: targetMode,
          session,
          ...clampContextMenuPosition(event.clientX, event.clientY)
        })
      }}
    >
      <strong>
        {sessionTitle(session, prefs.aliases, t.sessionFallback(shortId(session.id)))}
      </strong>
      <span>
        {session.updated} - {session.status}
      </span>
    </button>
  )

  const selectedSessionTitle = selectedSession
    ? sessionTitle(selectedSession, prefs.aliases, t.sessionFallback(shortId(selectedSession.id)))
    : t.newConversation

  const setSelectedModel = (nextModel: string): void => {
    setModel(nextModel)
    setPrefs((current) => ({ ...current, selectedModel: nextModel }))
  }

  const setAssistantViewMode = (assistantViewMode: AssistantViewMode): void => {
    setPrefs((current) => ({ ...current, assistantViewMode }))
  }

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
        setModel={setSelectedModel}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        assistantViewMode={prefs.assistantViewMode}
        setAssistantViewMode={setAssistantViewMode}
        visibleSessions={visibleSessions}
        renderSession={renderSession}
        onHide={() => setIsSidebarHidden(true)}
      />

      <ChatPanel
        t={t}
        mode={mode}
        isSidebarHidden={isSidebarHidden}
        logoStyle={logoStyle}
        showSidebar={() => setIsSidebarHidden(false)}
        selectedSessionTitle={selectedSessionTitle}
        activeConversation={activeConversation}
        contextUsage={activeConversation.contextUsage}
        contextUsageSupport={cliCapabilities.contextUsageSupport}
        error={error}
        scrollerRef={scrollerRef}
        updateScrollBottomVisibility={updateScrollBottomVisibility}
        showScrollBottom={showScrollBottom}
        scrollToBottom={scrollToBottom}
        assistantViewMode={prefs.assistantViewMode}
        messages={activeConversation.messages}
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
        prompt={prompt}
        setPrompt={setPrompt}
        sendPrompt={sendPrompt}
        onComposerKeyDown={onComposerKeyDown}
        isSending={Boolean(activeConversation.activeRunId)}
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
