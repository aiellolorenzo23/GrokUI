import { describe, expect, it } from 'vitest'
import {
  buildCliModelForRun,
  fallbackMode,
  findConversationKeyByRunId,
  getConversationRunCwd,
  getConversationRunMode,
  isMissingSessionError
} from './session'

describe('isMissingSessionError', () => {
  it('detects missing session errors from cli messages', () => {
    expect(isMissingSessionError(new Error("Couldn't create session: Session does not exist"))).toBe(true)
    expect(isMissingSessionError('Error: Session does not exist')).toBe(true)
    expect(isMissingSessionError(new Error('Permission denied'))).toBe(false)
  })
})

describe('fallbackMode', () => {
  it('switches between grok and agent', () => {
    expect(fallbackMode('grok')).toBe('agent')
    expect(fallbackMode('agent')).toBe('grok')
  })
})

describe('conversation run helpers', () => {
  it('prefers session mode and cwd when present', () => {
    const conversation = {
      messages: [],
      sessionMode: 'agent' as const,
      sessionCwd: 'C:\\Users\\lollo'
    }

    expect(getConversationRunMode(conversation, 'grok')).toBe('agent')
    expect(getConversationRunCwd(conversation, 'C:\\fallback')).toBe('C:\\Users\\lollo')
  })

  it('falls back to current mode and cwd for draft conversations', () => {
    const conversation = { messages: [] }

    expect(getConversationRunMode(conversation, 'grok')).toBe('grok')
    expect(getConversationRunCwd(conversation, 'C:\\fallback')).toBe('C:\\fallback')
  })
})

describe('buildCliModelForRun', () => {
  it('uses the selected model only for new conversations', () => {
    expect(buildCliModelForRun(undefined, 'grok-build')).toBe('grok-build')
    expect(buildCliModelForRun('session-123', 'grok-build')).toBeUndefined()
  })
})

describe('findConversationKeyByRunId', () => {
  it('finds the matching conversation only inside the same mode', () => {
    const conversations = {
      'grok:draft': { messages: [], activeRunId: 'run-a' },
      'agent:draft': { messages: [], activeRunId: 'run-b' },
      'grok:session:1': { messages: [], activeRunId: 'run-c' }
    }

    expect(findConversationKeyByRunId(conversations, 'grok', 'run-c')).toBe('grok:session:1')
    expect(findConversationKeyByRunId(conversations, 'grok', 'run-b')).toBeUndefined()
  })
})
