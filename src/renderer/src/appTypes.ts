import type { CliContextUsage, CliMode, CliSession } from '../../shared/types'

export type AssistantViewMode = 'grokui' | 'cli'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  media?: string[]
  mediaLinks?: string[]
}

export type ConversationState = {
  messages: ChatMessage[]
  activeSessionId?: string
  activeRunId?: string
  contextUsage?: CliContextUsage
}

export type SessionPrefs = {
  hidden: Record<CliMode, string[]>
  aliases: Record<string, string>
  agentSessionIds: string[]
  assistantViewMode: AssistantViewMode
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
    agentSessionIds: [],
    assistantViewMode: 'grokui'
  }
}
