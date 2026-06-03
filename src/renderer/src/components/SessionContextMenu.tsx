import type { CliMode, CliSession } from '../../../shared/types'
import type { Dictionary } from '../i18n'

type SessionContextMenuProps = {
  x: number
  y: number
  mode: CliMode
  session: CliSession
  t: Dictionary
  renameSession: (session: CliSession) => void
  moveToAgent: (session: CliSession) => void
  hideSession: (mode: CliMode, session: CliSession) => void
}

export function SessionContextMenu({
  x,
  y,
  mode,
  session,
  t,
  renameSession,
  moveToAgent,
  hideSession
}: SessionContextMenuProps): React.JSX.Element {
  return (
    <div className="session-menu" style={{ left: x, top: y }} role="menu">
      <button onClick={() => renameSession(session)}>{t.rename}</button>
      {mode === 'grok' && <button onClick={() => moveToAgent(session)}>{t.addToAgent}</button>}
      <button onClick={() => hideSession(mode, session)}>{t.hideOnlyInApp}</button>
    </div>
  )
}
