import type { CliMode, CliSession } from '../../shared/types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  media?: string[]
}

export type ConversationState = {
  messages: ChatMessage[]
  activeSessionId?: string
  activeRunId?: string
}

export type SessionPrefs = {
  hidden: Record<CliMode, string[]>
  aliases: Record<string, string>
  agentSessionIds: string[]
}

export type ContextMenuState = {
  mode: CliMode
  session: CliSession
  x: number
  y: number
}

export type RenameState = {
  session: CliSession
  value: string
}

export type AttachedFile = {
  path: string
  name: string
  mediaType: 'image' | 'video' | 'file'
}

export const initialConversations: Record<CliMode, ConversationState> = {
  grok: { messages: [] },
  agent: { messages: [] }
}

export function getDefaultPrefs(): SessionPrefs {
  return {
    hidden: { grok: [], agent: [] },
    aliases: {},
    agentSessionIds: []
  }
}
