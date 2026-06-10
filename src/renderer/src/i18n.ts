export type Locale = 'it' | 'en'

export type Dictionary = {
  sessionFallback: (id: string) => string
  viewMedia: (mediaType: 'image' | 'video' | 'file') => string
  openContainingFolder: string
  cliError: string
  fileAttachmentsLabel: string
  hideMenu: string
  showMenu: string
  modesLabel: string
  actionsLabel: string
  newChat: string
  loadingSessions: string
  refreshSessions: string
  workingDirectory: string
  model: string
  defaultCliPlaceholder: string
  loadingModels: string
  defaultModelSuffix: string
  grokSection: string
  agentSection: string
  conversationsSection: string
  refresh: string
  noConversationsForMode: string
  noAssignedAgentSessions: string
  sync: string
  stop: string
  context: string
  contextUnavailable: string
  contextUnavailableHint: string
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
  reasoning: string
  expandReasoning: string
  collapseReasoning: string
  scrollToLatest: string
  copyCode: string
  copyMessage: string
  copyTable: string
  wrapCode: string
  unwrapCode: string
  expandCode: (lineCount: number) => string
  collapseCode: string
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
    openContainingFolder: 'Apri cartella',
    cliError: 'Errore CLI',
    fileAttachmentsLabel: 'File allegati',
    hideMenu: 'Nascondi menu',
    showMenu: 'Mostra menu',
    modesLabel: 'Modalita',
    actionsLabel: 'Azioni',
    newChat: 'Nuova Chat',
    loadingSessions: 'Carico sessioni',
    refreshSessions: 'Aggiorna sessioni',
    workingDirectory: 'Working directory',
    model: 'Modello',
    defaultCliPlaceholder: 'default CLI',
    loadingModels: 'Carico modelli',
    defaultModelSuffix: '(default)',
    grokSection: 'Grok',
    agentSection: 'Agent',
    conversationsSection: 'Conversazioni',
    refresh: 'Aggiorna',
    noConversationsForMode: 'Nessuna conversazione per questa modalita.',
    noAssignedAgentSessions: 'Nessuna sessione Agent assegnata.',
    sync: 'Sincronizza',
    stop: 'Stop',
    context: 'Contesto',
    contextUnavailable: 'Dati contesto non disponibili',
    contextUnavailableHint:
      'La CLI locale usata da GrokUI non espone sempre queste metriche nel flusso streaming, quindi il badge puo restare vuoto anche durante la risposta.',
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
    reasoning: 'Ragionamento',
    expandReasoning: 'Espandi',
    collapseReasoning: 'Comprimi',
    scrollToLatest: "Vai all'ultimo messaggio",
    copyCode: 'Copia',
    copyMessage: 'Copia messaggio',
    copyTable: 'Copia tabella',
    wrapCode: 'A capo',
    unwrapCode: 'No a capo',
    expandCode: (lineCount) => `Espandi (${lineCount} righe)`,
    collapseCode: 'Comprimi',
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
    openContainingFolder: 'Open folder',
    cliError: 'CLI error',
    fileAttachmentsLabel: 'File attachments',
    hideMenu: 'Hide menu',
    showMenu: 'Show menu',
    modesLabel: 'Modes',
    actionsLabel: 'Actions',
    newChat: 'New Chat',
    loadingSessions: 'Loading sessions',
    refreshSessions: 'Refresh sessions',
    workingDirectory: 'Working directory',
    model: 'Model',
    defaultCliPlaceholder: 'default CLI',
    loadingModels: 'Loading models',
    defaultModelSuffix: '(default)',
    grokSection: 'Grok',
    agentSection: 'Agent',
    conversationsSection: 'Conversations',
    refresh: 'Refresh',
    noConversationsForMode: 'No conversations for this mode.',
    noAssignedAgentSessions: 'No Agent sessions assigned.',
    sync: 'Sync',
    stop: 'Stop',
    context: 'Context',
    contextUnavailable: 'Context data unavailable',
    contextUnavailableHint:
      'The local CLI used by GrokUI does not always expose these metrics in the streaming output, so the badge can stay empty even while a response is running.',
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
    reasoning: 'Reasoning',
    expandReasoning: 'Expand',
    collapseReasoning: 'Collapse',
    scrollToLatest: 'Go to latest message',
    copyCode: 'Copy',
    copyMessage: 'Copy message',
    copyTable: 'Copy table',
    wrapCode: 'Wrap',
    unwrapCode: 'No wrap',
    expandCode: (lineCount) => `Expand (${lineCount} lines)`,
    collapseCode: 'Collapse',
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
