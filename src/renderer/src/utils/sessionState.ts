import type { CliContextUsage, CliMode } from '../../../shared/types'
import type { ConversationState } from '../appTypes'
import { createChatMessage } from './chat'
import { findConversationKeyByRunId } from './session'

export type ConversationMap = Record<string, ConversationState>
export type ActiveConversationKeyMap = Record<CliMode, string>

export function createDraftConversationState(): ConversationState {
  return { messages: [] }
}

export function getDraftConversationKey(mode: CliMode): string {
  return `${mode}:draft`
}

export function getSessionConversationKey(mode: CliMode, sessionId: string): string {
  return `${mode}:session:${sessionId}`
}

export function applyContextUsageEvent(
  conversations: ConversationMap,
  mode: CliMode,
  runId: string,
  contextUsage: CliContextUsage
): ConversationMap {
  const key = findConversationKeyByRunId(conversations, mode, runId)
  if (!key) return conversations

  return {
    ...conversations,
    [key]: {
      ...conversations[key],
      contextUsage
    }
  }
}

export function applyTextStreamEvent(
  conversations: ConversationMap,
  mode: CliMode,
  runId: string,
  chunk: string
): ConversationMap {
  const key = findConversationKeyByRunId(conversations, mode, runId)
  if (!key) return conversations

  const target = conversations[key]
  const messages = [...target.messages]
  const last = messages[messages.length - 1]

  if (last?.role === 'assistant') {
    const nextContent = `${last.content}${chunk}`
    messages[messages.length - 1] = {
      ...createChatMessage('assistant', nextContent, {
        id: last.id,
        media: last.media,
        reasoning: last.reasoning,
        reasoningCollapsed: last.reasoning ? true : last.reasoningCollapsed
      }),
      media: last.media
    }
  } else {
    messages.push(createChatMessage('assistant', chunk))
  }

  return { ...conversations, [key]: { ...target, messages } }
}

export function applyThoughtStreamEvent(
  conversations: ConversationMap,
  mode: CliMode,
  runId: string,
  chunk: string
): ConversationMap {
  const key = findConversationKeyByRunId(conversations, mode, runId)
  if (!key) return conversations

  const target = conversations[key]
  const messages = [...target.messages]
  const last = messages[messages.length - 1]

  if (last?.role === 'assistant') {
    messages[messages.length - 1] = {
      ...createChatMessage('assistant', last.content, {
        id: last.id,
        media: last.media,
        reasoning: `${last.reasoning ?? ''}${chunk}`,
        reasoningCollapsed: last.reasoningCollapsed
      }),
      media: last.media
    }
  } else {
    messages.push(
      createChatMessage('assistant', '', {
        reasoning: chunk,
        reasoningCollapsed: false
      })
    )
  }

  return { ...conversations, [key]: { ...target, messages } }
}

export function applyErrorStreamEvent(
  conversations: ConversationMap,
  mode: CliMode,
  runId: string,
  fallbackText: string,
  text?: string
): ConversationMap {
  const key = findConversationKeyByRunId(conversations, mode, runId)
  if (!key) return conversations
  const target = conversations[key]

  return {
    ...conversations,
    [key]: {
      ...target,
      messages: [...target.messages, createChatMessage('system', text ?? fallbackText)]
    }
  }
}

export function applyExitStreamEvent(
  conversations: ConversationMap,
  mode: CliMode,
  runId: string
): ConversationMap {
  const key = findConversationKeyByRunId(conversations, mode, runId)
  if (!key) return conversations
  const target = conversations[key]
  return { ...conversations, [key]: { ...target, activeRunId: undefined } }
}

export function applySessionEndEvent(
  conversations: ConversationMap,
  activeConversationKeys: ActiveConversationKeyMap,
  mode: CliMode,
  runId: string,
  sessionId: string
): { conversations: ConversationMap; activeConversationKeys: ActiveConversationKeyMap } {
  const sourceKey = findConversationKeyByRunId(conversations, mode, runId)
  if (!sourceKey) {
    return { conversations, activeConversationKeys }
  }

  const target = conversations[sourceKey]
  const sessionKey = getSessionConversationKey(mode, sessionId)
  const nextConversation = { ...target, activeSessionId: sessionId }
  let nextConversations: ConversationMap

  if (sourceKey === sessionKey) {
    nextConversations = { ...conversations, [sourceKey]: nextConversation }
  } else {
    nextConversations = {
      ...conversations,
      [sessionKey]: nextConversation
    }

    delete nextConversations[sourceKey]

    const draftKey = getDraftConversationKey(mode)
    if (!nextConversations[draftKey]) {
      nextConversations[draftKey] = createDraftConversationState()
    }
  }

  const nextActiveConversationKeys =
    activeConversationKeys[mode] === sourceKey
      ? { ...activeConversationKeys, [mode]: sessionKey }
      : activeConversationKeys

  return {
    conversations: nextConversations,
    activeConversationKeys: nextActiveConversationKeys
  }
}
