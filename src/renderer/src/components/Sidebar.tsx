import type { CSSProperties } from 'react'
import type { CliMode, CliSession } from '../../../shared/types'
import type { AssistantViewMode } from '../appTypes'
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
  assistantViewMode: AssistantViewMode
  setAssistantViewMode: (mode: AssistantViewMode) => void
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
  assistantViewMode,
  setAssistantViewMode,
  visibleSessions,
  renderSession,
  onHide
}: SidebarProps): React.JSX.Element | null {
  return (
    <aside className={isHidden ? 'grok-sidebar hidden' : 'grok-sidebar'} aria-hidden={isHidden}>
      <div className="sidebar-head">
        <div className="brand-logo" style={logoStyle} aria-label="GrokUI" />
        <button className="sidebar-toggle-button" aria-label={t.hideMenu} title={t.hideMenu} onClick={onHide}>
          <span aria-hidden="true">&lsaquo;</span>
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
        <div className="settings-toggle">
          <span>{t.assistantStyle}</span>
          <div className="segmented-toggle" role="tablist" aria-label={t.assistantStyle}>
            <button
              type="button"
              className={assistantViewMode === 'grokui' ? 'active' : ''}
              onClick={() => setAssistantViewMode('grokui')}
            >
              {t.grokUiStyle}
            </button>
            <button
              type="button"
              className={assistantViewMode === 'cli' ? 'active' : ''}
              onClick={() => setAssistantViewMode('cli')}
            >
              {t.cliStyle}
            </button>
          </div>
        </div>
      </section>

      <section className="history">
        <div className="section-row">
          <span>{t.conversationsSection}</span>
          <button onClick={() => void refreshSessions(mode)}>{t.refresh}</button>
        </div>
        <div className="history-list">
          {visibleSessions[mode].length === 0 && <p className="empty-list">{t.noConversationsForMode}</p>}
          {visibleSessions[mode].map((session) => renderSession(mode, session))}
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
