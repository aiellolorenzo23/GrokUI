import type { CSSProperties } from 'react'
import type { CliMode, CliSession } from '../../../shared/types'
import type { Dictionary } from '../i18n'

type SidebarProps = {
  isHidden: boolean
  logoStyle: CSSProperties
  t: Dictionary
  mode: CliMode
  setMode: (mode: CliMode) => void
  startNew: () => void
  refreshSessions: (targetMode?: CliMode) => Promise<void>
  isLoadingSessions: boolean
  cwd: string
  setCwd: (cwd: string) => void
  model: string
  setModel: (model: string) => void
  visibleSessions: Record<CliMode, CliSession[]>
  renderSession: (targetMode: CliMode, session: CliSession) => React.JSX.Element
  onHide: () => void
}

export function Sidebar({
  isHidden,
  logoStyle,
  t,
  mode,
  setMode,
  startNew,
  refreshSessions,
  isLoadingSessions,
  cwd,
  setCwd,
  model,
  setModel,
  visibleSessions,
  renderSession,
  onHide
}: SidebarProps): React.JSX.Element | null {
  if (isHidden) return null

  return (
    <aside className="grok-sidebar">
      <div className="sidebar-head">
        <div className="brand-logo" style={logoStyle} aria-label="GrokUI" />
        <button className="collapse-button" aria-label={t.hideMenu} title={t.hideMenu} onClick={onHide}>
          &lt;&lt;
        </button>
      </div>

      <div className="mode-tabs" aria-label={t.modesLabel}>
        <button className={mode === 'grok' ? 'active' : ''} onClick={() => setMode('grok')}>
          Grok
        </button>
        <button className={mode === 'agent' ? 'active' : ''} onClick={() => setMode('agent')}>
          Agent
        </button>
      </div>

      <nav className="primary-nav" aria-label={t.actionsLabel}>
        <button onClick={startNew}>
          <span className="nav-icon">+</span>
          {t.newChat}
        </button>
        <button onClick={() => void refreshSessions()}>
          <span className="nav-icon">R</span>
          {isLoadingSessions ? t.loadingSessions : t.refreshSessions}
        </button>
      </nav>

      <section className="settings-block">
        <label>
          {t.workingDirectory}
          <input value={cwd} onChange={(event) => setCwd(event.target.value)} />
        </label>
        <label>
          {t.model}
          <input
            value={model}
            placeholder={t.defaultCliPlaceholder}
            onChange={(event) => setModel(event.target.value)}
          />
        </label>
      </section>

      <section className="history">
        <div className="section-row">
          <span>{t.grokSection}</span>
          <button onClick={() => void refreshSessions('grok')}>{t.refresh}</button>
        </div>
        <div className="history-list">{visibleSessions.grok.map((session) => renderSession('grok', session))}</div>
      </section>

      <section className="history">
        <div className="section-row">
          <span>{t.agentSection}</span>
          <button onClick={() => void refreshSessions('agent')}>{t.refresh}</button>
        </div>
        <div className="history-list">
          {visibleSessions.agent.length === 0 && <p className="empty-list">{t.noAssignedAgentSessions}</p>}
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
  )
}
