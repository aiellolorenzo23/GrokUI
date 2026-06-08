import { describe, expect, it } from 'vitest'
import type { CliContextUsage } from '../../../shared/types'
import type { ConversationState } from '../appTypes'
import {
  applyContextUsageEvent,
  applyErrorStreamEvent,
  applyExitStreamEvent,
  applySessionEndEvent,
  applyTextStreamEvent,
  getDraftConversationKey,
  getSessionConversationKey
} from './sessionState'

function createConversations(): Record<string, ConversationState> {
  return {
    'grok:draft': {
      messages: [{ id: 'u1', role: 'user', content: 'hello' }],
      activeRunId: 'run-grok'
    },
    'agent:draft': {
      messages: [{ id: 'u2', role: 'user', content: 'other' }],
      activeRunId: 'run-agent'
    }
  }
}

describe('applyTextStreamEvent', () => {
  it('routes chunks to the matching conversation even when another mode has an active run', () => {
    const updated = applyTextStreamEvent(createConversations(), 'grok', 'run-grok', 'partial')

    expect(updated['grok:draft'].messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'partial'
    })
    expect(updated['agent:draft'].messages).toHaveLength(1)
  })

  it('appends to the existing assistant message for the same run', () => {
    const conversations = createConversations()
    conversations['grok:draft'] = {
      ...conversations['grok:draft'],
      messages: [
        { id: 'u1', role: 'user', content: 'hello' },
        { id: 'a1', role: 'assistant', content: 'part' }
      ]
    }

    const updated = applyTextStreamEvent(conversations, 'grok', 'run-grok', 'ial')
    expect(updated['grok:draft'].messages.at(-1)).toMatchObject({
      id: 'a1',
      role: 'assistant',
      content: 'partial'
    })
  })
})

describe('applySessionEndEvent', () => {
  it('migrates a draft conversation to the session key and keeps a fresh draft', () => {
    const current = createConversations()
    const activeKeys = { grok: 'grok:draft', agent: 'agent:draft' } as const

    const result = applySessionEndEvent(
      current,
      { ...activeKeys },
      'grok',
      'run-grok',
      'session-123'
    )

    expect(result.conversations[getSessionConversationKey('grok', 'session-123')]).toMatchObject({
      activeSessionId: 'session-123',
      activeRunId: 'run-grok'
    })
    expect(result.conversations[getDraftConversationKey('grok')]).toMatchObject({ messages: [] })
    expect(result.activeConversationKeys.grok).toBe(
      getSessionConversationKey('grok', 'session-123')
    )
    expect(result.activeConversationKeys.agent).toBe('agent:draft')
  })

  it('does not switch the active key for a background conversation', () => {
    const current = {
      ...createConversations(),
      'grok:session:old': {
        messages: [{ id: 'x', role: 'assistant' as const, content: 'running' }],
        activeRunId: 'run-old',
        activeSessionId: 'old'
      }
    }
    const activeKeys = { grok: 'grok:draft', agent: 'agent:draft' }

    const result = applySessionEndEvent(current, activeKeys, 'grok', 'run-old', 'old')

    expect(result.activeConversationKeys.grok).toBe('grok:draft')
    expect(result.conversations['grok:session:old']).toBeDefined()
  })
})

describe('applyContextUsageEvent', () => {
  it('stores context usage on the matching conversation', () => {
    const usage: CliContextUsage = {
      usedTokens: '10k',
      totalTokens: '100k',
      percentage: 10,
      percentageLabel: '10%',
      breakdown: []
    }

    const updated = applyContextUsageEvent(createConversations(), 'grok', 'run-grok', usage)
    expect(updated['grok:draft'].contextUsage).toEqual(usage)
    expect(updated['agent:draft'].contextUsage).toBeUndefined()
  })
})

describe('applyErrorStreamEvent', () => {
  it('adds a system message only to the matching conversation', () => {
    const updated = applyErrorStreamEvent(
      createConversations(),
      'agent',
      'run-agent',
      'fallback',
      'boom'
    )

    expect(updated['agent:draft'].messages.at(-1)).toMatchObject({
      role: 'system',
      content: 'boom'
    })
    expect(updated['grok:draft'].messages).toHaveLength(1)
  })
})

describe('applyExitStreamEvent', () => {
  it('clears activeRunId only on the matching conversation', () => {
    const updated = applyExitStreamEvent(createConversations(), 'grok', 'run-grok')

    expect(updated['grok:draft'].activeRunId).toBeUndefined()
    expect(updated['agent:draft'].activeRunId).toBe('run-agent')
  })
})
