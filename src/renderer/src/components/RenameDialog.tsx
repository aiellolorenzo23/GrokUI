import { useEffect, useRef } from 'react'
import type { RenameState } from '../appTypes'
import type { Dictionary } from '../i18n'

type RenameDialogProps = {
  renameTarget: RenameState
  t: Dictionary
  setRenameTarget: (updater: RenameState | undefined | ((current: RenameState | undefined) => RenameState | undefined)) => void
  confirmRename: () => void
  close: () => void
}

export function RenameDialog({
  renameTarget,
  t,
  setRenameTarget,
  confirmRename,
  close
}: RenameDialogProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <div className="dialog-backdrop" onClick={close}>
      <form
        className="rename-dialog"
        onSubmit={(event) => {
          event.preventDefault()
          confirmRename()
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <label>
          {t.renameSession}
          <input
            ref={inputRef}
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
          <button type="button" onClick={close}>
            {t.cancel}
          </button>
          <button type="submit" disabled={!renameTarget.value.trim()}>
            {t.save}
          </button>
        </div>
      </form>
    </div>
  )
}
