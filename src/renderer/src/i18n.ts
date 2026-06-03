export type Locale = 'it' | 'en'

export type Dictionary = {
  sessionFallback: (id: string) => string
  viewMedia: (mediaType: 'image' | 'video' | 'file') => string
  cliError: string
  fileAttachmentsLabel: string
  hideMenu: string
  modesLabel: string
  actionsLabel: string
  newChat: string
  loadingSessions: string
  refreshSessions: string
  workingDirectory: string
  model: string
  defaultCliPlaceholder: string
  grokSection: string
  agentSection: string
  refresh: string
  noAssignedAgentSessions: string
  sync: string
  stop: string
  grokCli: string
  agentCli: string
  grokModeDescription: string
  agentModeDescription: string
  assistantStyle: string
  grokUiStyle: string
  cliStyle: string
  newConversation: string
  talkToGrok: string
  startAgent: string
  emptyStateDescription: string
  you: string
  system: string
  responseInProgress: string
  scrollToLatest: string
  copyCode: string
  copied: string
  attachFile: string
  askGrokPlaceholder: string
  agentTaskPlaceholder: string
  send: string
  dropHint: string
  rename: string
  addToAgent: string
  hideOnlyInApp: string
  renameSession: string
  cancel: string
  save: string
}

const dictionaries: Record<Locale, Dictionary> = {
  it: {
    sessionFallback: (id) => `(sessione ${id})`,
    viewMedia: (mediaType) =>
      mediaType === 'video' ? 'Apri video' : mediaType === 'file' ? 'Apri file' : 'Apri immagine',
    cliError: 'Errore CLI',
    fileAttachmentsLabel: 'File allegati',
    hideMenu: 'Nascondi menu',
    modesLabel: 'Modalita',
    actionsLabel: 'Azioni',
    newChat: 'Nuova Chat',
    loadingSessions: 'Carico sessioni',
    refreshSessions: 'Aggiorna sessioni',
    workingDirectory: 'Working directory',
    model: 'Modello',
    defaultCliPlaceholder: 'default CLI',
    grokSection: 'Grok',
    agentSection: 'Agent',
    refresh: 'Aggiorna',
    noAssignedAgentSessions: 'Nessuna sessione Agent assegnata.',
    sync: 'Sincronizza',
    stop: 'Stop',
    grokCli: 'Grok CLI',
    agentCli: 'Agent CLI',
    grokModeDescription: 'Chat diretta con Grok usando la CLI locale.',
    agentModeDescription: 'Workflow guidato per task multi-step tramite Agent CLI.',
    assistantStyle: 'Stile assistant',
    grokUiStyle: 'GrokUI',
    cliStyle: 'CLI',
    newConversation: 'Nuova conversazione',
    talkToGrok: 'Parla con Grok',
    startAgent: 'Avvia Agent',
    emptyStateDescription:
      'Le risposte arrivano dal CLI locale, lanciato in background senza finestre terminale visibili.',
    you: 'Tu',
    system: 'Sistema',
    responseInProgress: 'Risposta in corso',
    scrollToLatest: "Vai all'ultimo messaggio",
    copyCode: 'Copia',
    copied: 'Copiato',
    attachFile: 'Allega file',
    askGrokPlaceholder: 'Chiedi qualsiasi cosa a Grok',
    agentTaskPlaceholder: 'Dai un compito ad Agent',
    send: 'Invia',
    dropHint: 'Rilascia per allegare il path',
    rename: 'Rinomina',
    addToAgent: 'Aggiungi ad Agent',
    hideOnlyInApp: 'Nascondi solo in app',
    renameSession: 'Rinomina sessione',
    cancel: 'Annulla',
    save: 'Salva'
  },
  en: {
    sessionFallback: (id) => `(session ${id})`,
    viewMedia: (mediaType) =>
      mediaType === 'video' ? 'Open video' : mediaType === 'file' ? 'Open file' : 'Open image',
    cliError: 'CLI error',
    fileAttachmentsLabel: 'File attachments',
    hideMenu: 'Hide menu',
    modesLabel: 'Modes',
    actionsLabel: 'Actions',
    newChat: 'New Chat',
    loadingSessions: 'Loading sessions',
    refreshSessions: 'Refresh sessions',
    workingDirectory: 'Working directory',
    model: 'Model',
    defaultCliPlaceholder: 'default CLI',
    grokSection: 'Grok',
    agentSection: 'Agent',
    refresh: 'Refresh',
    noAssignedAgentSessions: 'No Agent sessions assigned.',
    sync: 'Sync',
    stop: 'Stop',
    grokCli: 'Grok CLI',
    agentCli: 'Agent CLI',
    grokModeDescription: 'Direct chat with Grok using the local CLI.',
    agentModeDescription: 'Guided multi-step task workflow through Agent CLI.',
    assistantStyle: 'Assistant style',
    grokUiStyle: 'GrokUI',
    cliStyle: 'CLI',
    newConversation: 'New conversation',
    talkToGrok: 'Talk to Grok',
    startAgent: 'Start Agent',
    emptyStateDescription:
      'Responses come from the local CLI, launched in the background with no visible terminal windows.',
    you: 'You',
    system: 'System',
    responseInProgress: 'Response in progress',
    scrollToLatest: 'Go to latest message',
    copyCode: 'Copy',
    copied: 'Copied',
    attachFile: 'Attach file',
    askGrokPlaceholder: 'Ask Grok anything',
    agentTaskPlaceholder: 'Give Agent a task',
    send: 'Send',
    dropHint: 'Drop to attach the path',
    rename: 'Rename',
    addToAgent: 'Add to Agent',
    hideOnlyInApp: 'Hide only in app',
    renameSession: 'Rename session',
    cancel: 'Cancel',
    save: 'Save'
  }
}

export function resolveLocale(locale: string | null | undefined): Locale {
  const normalized = locale?.toLowerCase().trim()
  if (normalized?.startsWith('it')) return 'it'
  return 'en'
}

export function getDictionary(locale: string | null | undefined): Dictionary {
  return dictionaries[resolveLocale(locale)]
}
