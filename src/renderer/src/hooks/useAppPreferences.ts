import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { getDefaultPrefs, type SessionPrefs } from '../appTypes'
import { loadLegacyPrefs, normalizePrefs } from '../utils/chat'

export function useAppPreferences(): [SessionPrefs, Dispatch<SetStateAction<SessionPrefs>>] {
  const [prefs, setPrefs] = useState<SessionPrefs>(() => getDefaultPrefs())
  const prefsLoadedRef = useRef(false)

  useEffect(() => {
    void window.api.readPreferences().then((storedPrefs) => {
      const defaults = getDefaultPrefs()
      const nextPrefs = storedPrefs
        ? normalizePrefs(storedPrefs, defaults)
        : normalizePrefs(loadLegacyPrefs(), defaults)

      setPrefs(nextPrefs)
      prefsLoadedRef.current = true
      void window.api.writePreferences(nextPrefs)
    })
  }, [])

  useEffect(() => {
    if (!prefsLoadedRef.current) return
    void window.api.writePreferences(prefs)
  }, [prefs])

  return [prefs, setPrefs]
}
