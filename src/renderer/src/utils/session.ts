import type { CliMode } from '../../../shared/types'
import type { ConversationState } from '../appTypes'

export type SessionAccessResult = {
  mode: CliMode
  transcript: string
}

export type ResolveSessionAccess = (
  preferredMode: CliMode,
  sessionId: string,
  sessionCwd: string
) => Promise<SessionAccessResult>

export function isMissingSessionError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason)
  return /session does not exist/i.test(message)
}

export function fallbackMode(mode: CliMode): CliMode {
  return mode === 'grok' ? 'agent' : 'grok'
}

export function getConversationRunMode(
  conversation: ConversationState,
  currentMode: CliMode
): CliMode {
  return conversation.sessionMode ?? currentMode
}

export function getConversationRunCwd(conversation: ConversationState, currentCwd: string): string {
  return conversation.sessionCwd ?? currentCwd
}

export function buildCliModelForRun(
  sessionId: string | undefined,
  selectedModel: string
): string | undefined {
  return sessionId ? undefined : selectedModel
}

export function findConversationKeyByRunId(
  conversations: Record<string, ConversationState>,
  mode: CliMode,
  runId: string
): string | undefined {
  const prefix = `${mode}:`
  return Object.entries(conversations).find(
    ([key, conversation]) => key.startsWith(prefix) && conversation.activeRunId === runId
  )?.[0]
}
