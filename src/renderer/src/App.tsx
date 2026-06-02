import { type CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react'
import type { CliMode, CliSession, CliStreamEvent } from '../../shared/types'
import grokLogo from '../../../resources/logo.svg'

type ConversationState = {
  transcript: string
  liveOutput: string
  activeSessionId?: string
  activeRunId?: string
}

const initialConversations: Record<CliMode, ConversationState> = {
  grok: { transcript: '', liveOutput: '' },
  agent: { transcript: '', liveOutput: '' }
}

const defaultCwd = 'C:\\Users\\lollo'

function shortId(id: string): string {
  return id.slice(0, 8)
}

function sessionTitle(session: CliSession): string {
  return session.summary || `(sessione ${shortId(session.id)})`
}

function App(): React.JSX.Element {
  const [mode, setMode] = useState<CliMode>('grok')
  const [cwd, setCwd] = useState(defaultCwd)
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sessions, setSessions] = useState<Record<CliMode, CliSession[]>>({ grok: [], agent: [] })
  const [conversations, setConversations] =
    useState<Record<CliMode, ConversationState>>(initialConversations)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()

  const logoStyle = { '--logo': `url(${grokLogo})` } as CSSProperties
  const activeConversation = conversations[mode]
  const activeSessions = sessions[mode]

  const selectedSession = useMemo(
    () => activeSessions.find((session) => session.id === activeConversation.activeSessionId),
    [activeConversation.activeSessionId, activeSessions]
  )

  useEffect(() => {
    return window.api.onCliStream((event: CliStreamEvent) => {
      setConversations((current) => {
        const target = current[event.mode]

        if (target.activeRunId !== event.runId) return current

        if (event.kind === 'text' || event.kind === 'stdout') {
          return {
            ...current,
            [event.mode]: {
              ...target,
              liveOutput: `${target.liveOutput}${event.text ?? ''}${event.kind === 'stdout' ? '\n' : ''}`
            }
          }
        }

        if (event.kind === 'stderr' || event.kind === 'error') {
          return {
            ...current,
            [event.mode]: {
              ...target,
              liveOutput: `${target.liveOutput}\n${event.text ?? ''}`
            }
          }
        }

        if (event.kind === 'exit') {
          setIsSending(false)
          return {
            ...current,
            [event.mode]: {
              ...target,
              activeRunId: undefined
            }
          }
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
      const [grokSessions, agentSessions] = await Promise.all([
        window.api.listSessions('grok', cwd, 50),
        window.api.listSessions('agent', cwd, 50)
      ])
      setSessions({ grok: grokSessions, agent: agentSessions })
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
      setConversations((current) => ({
        ...current,
        [targetMode]: {
          transcript,
          liveOutput: '',
          activeSessionId: session.id,
          activeRunId: undefined
        }
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const startNew = (): void => {
    setConversations((current) => ({
      ...current,
      [mode]: { transcript: '', liveOutput: '' }
    }))
    setPrompt('')
  }

  const stopCurrent = async (): Promise<void> => {
    const runId = activeConversation.activeRunId
    if (!runId) return
    await window.api.stopCli(runId)
    setIsSending(false)
  }

  const sendPrompt = async (event: FormEvent): Promise<void> => {
    event.preventDefault()

    const text = prompt.trim()
    if (!text || isSending) return

    setPrompt('')
    setIsSending(true)
    setError(undefined)

    setConversations((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        liveOutput: `${current[mode].liveOutput}\n> ${text}\n\n`
      }
    }))

    try {
      const started = await window.api.startCli({
        mode,
        cwd,
        prompt: text,
        sessionId: activeConversation.activeSessionId,
        model
      })

      setConversations((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          activeRunId: started.runId
        }
      }))
    } catch (reason) {
      setIsSending(false)
      setPrompt(text)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
    <main className="grok-shell">
      <aside className="grok-sidebar">
        <div className="sidebar-head">
          <div className="brand-logo" style={logoStyle} aria-label="GrokUI" />
          <button className="collapse-button" aria-label="Comprimi sidebar">
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
            <span className="nav-icon">S</span>
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
            {sessions.grok.map((session) => (
              <button
                key={session.id}
                className={
                  mode === 'grok' && activeConversation.activeSessionId === session.id
                    ? 'history-item active'
                    : 'history-item'
                }
                onClick={() => openSession('grok', session)}
              >
                <strong>{sessionTitle(session)}</strong>
                <span>
                  {session.updated} - {session.status}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="history">
          <div className="section-row">
            <span>Agent</span>
            <button onClick={() => refreshSessions('agent')}>Aggiorna</button>
          </div>
          <div className="history-list">
            {sessions.agent.map((session) => (
              <button
                key={session.id}
                className={
                  mode === 'agent' && activeConversation.activeSessionId === session.id
                    ? 'history-item active'
                    : 'history-item'
                }
                onClick={() => openSession('agent', session)}
              >
                <strong>{sessionTitle(session)}</strong>
                <span>
                  {session.updated} - {session.status}
                </span>
              </button>
            ))}
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

      <section className="chat-surface">
        <header className="chat-topbar">
          <div>
            <p>{mode === 'grok' ? 'Grok CLI' : 'Agent CLI'}</p>
            <h1>{selectedSession ? sessionTitle(selectedSession) : 'Nuova conversazione'}</h1>
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

        <div className="conversation">
          {!activeConversation.transcript && !activeConversation.liveOutput && (
            <div className="empty-state">
              <h2>{mode === 'grok' ? 'Parla con Grok' : 'Avvia Agent'}</h2>
              <p>
                Le risposte arrivano dal CLI locale, lanciato in background senza finestre terminale
                visibili.
              </p>
            </div>
          )}

          {activeConversation.transcript && (
            <article className="transcript">
              <pre>{activeConversation.transcript}</pre>
            </article>
          )}

          {activeConversation.liveOutput && (
            <article className="transcript live">
              <pre>{activeConversation.liveOutput}</pre>
            </article>
          )}
        </div>

        <form className="composer" onSubmit={sendPrompt}>
          <button className="add-button" type="button" onClick={startNew} aria-label="Nuova chat">
            +
          </button>
          <input
            value={prompt}
            placeholder={
              mode === 'grok' ? 'Chiedi qualsiasi cosa a Grok' : 'Dai un compito ad Agent'
            }
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button className="tool-button" type="button" onClick={() => refreshSessions()}>
            S
          </button>
          <button className="voice-button" disabled={!prompt.trim() || isSending}>
            {isSending ? '...' : 'Invia'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
