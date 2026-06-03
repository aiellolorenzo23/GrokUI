import type { CliSession } from '../../../shared/types'
import type { AttachedFile, ChatMessage, SessionPrefs } from '../appTypes'

const prefsKey = 'grokui.sessionPrefs'

export function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

export function loadLegacyPrefs(): SessionPrefs | null {
  try {
    const raw = localStorage.getItem(prefsKey)
    return raw ? (JSON.parse(raw) as SessionPrefs) : null
  } catch {
    return null
  }
}

export function normalizePrefs(value: unknown, defaults: SessionPrefs): SessionPrefs {
  if (!value || typeof value !== 'object') return defaults

  const record = value as Partial<SessionPrefs>
  return {
    hidden: {
      grok: Array.isArray(record.hidden?.grok) ? record.hidden.grok : defaults.hidden.grok,
      agent: Array.isArray(record.hidden?.agent) ? record.hidden.agent : defaults.hidden.agent
    },
    aliases:
      record.aliases && typeof record.aliases === 'object' ? record.aliases : defaults.aliases,
    agentSessionIds: Array.isArray(record.agentSessionIds)
      ? record.agentSessionIds
      : defaults.agentSessionIds
  }
}

export function sessionTitle(
  session: CliSession,
  aliases: Record<string, string>,
  fallbackLabel: string
): string {
  return aliases[session.id] || session.summary || fallbackLabel
}

export function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop()?.toLowerCase() ?? path.toLowerCase()
}

export function displayNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function extensionFromPath(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

export function mediaTypeFromPath(path: string): AttachedFile['mediaType'] {
  const extension = extensionFromPath(path)
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return 'image'
  if (['mp4', 'webm'].includes(extension)) return 'video'
  return 'file'
}

export function createAttachedFile(path: string): AttachedFile {
  return {
    path,
    name: displayNameFromPath(path),
    mediaType: mediaTypeFromPath(path)
  }
}

export function createChatMessage(
  role: ChatMessage['role'],
  content: string,
  extras: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    mediaLinks: extractMediaLinks(content),
    ...extras
  }
}

export function createDroppedFile(file: File): AttachedFile | undefined {
  const path = window.api.getFilePath(file)
  if (!path) return undefined

  return {
    path,
    name: file.name || displayNameFromPath(path),
    mediaType: mediaTypeFromPath(path)
  }
}

export function messageRoleFromHeading(heading: string): ChatMessage['role'] {
  if (heading.toLowerCase() === 'user') return 'user'
  if (heading.toLowerCase() === 'assistant') return 'assistant'
  return 'system'
}

export function attachMediaToMessages(messages: ChatMessage[], media: string[]): ChatMessage[] {
  if (media.length === 0) return messages

  const assigned = new Set<string>()
  const nextMessages = messages.map((message) => {
    const content = message.content.toLowerCase()
    const matches = media.filter((item) => content.includes(filenameFromPath(item)))
    if (matches.length === 0) return message

    matches.forEach((item) => assigned.add(item))
    return { ...message, media: Array.from(new Set([...(message.media ?? []), ...matches])) }
  })

  const remaining = media.filter((item) => !assigned.has(item))
  if (remaining.length === 0) return nextMessages

  const lastAssistantIndex = nextMessages.findLastIndex((message) => message.role === 'assistant')
  if (lastAssistantIndex < 0) return nextMessages

  const target = nextMessages[lastAssistantIndex]
  nextMessages[lastAssistantIndex] = {
    ...target,
    media: Array.from(new Set([...(target.media ?? []), ...remaining]))
  }

  return nextMessages
}

export function transcriptToMessages(transcript: string, media: string[] = []): ChatMessage[] {
  const trimmed = transcript.trim()
  if (!trimmed) return []

  const headingPattern = /^##\s+(User|Assistant|Tools|System)\s*$/gim
  const headings = Array.from(trimmed.matchAll(headingPattern))

  if (headings.length === 0) {
    return attachMediaToMessages(
      [
        {
          ...createChatMessage('assistant', trimmed)
        }
      ],
      media
    )
  }

  const messages = headings
    .map((heading, index) => {
      const start = (heading.index ?? 0) + heading[0].length
      const end = headings[index + 1]?.index ?? trimmed.length
      const content = trimmed.slice(start, end).trim()
      if (!content) return undefined

      return createChatMessage(messageRoleFromHeading(heading[1]), content)
    })
    .filter((message): message is ChatMessage => Boolean(message))

  return attachMediaToMessages(messages, media)
}

export function normalizeMediaLink(link: string): string {
  return link.replace(/[),.;]+$/g, '')
}

export function extractMediaLinks(text: string): string[] {
  const matches = text.match(
    /(?:file:\/\/\/[^\s)]+|[A-Za-z]:\\[^\n"']+\.(?:png|jpe?g|webp|gif|mp4|webm)|https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif|mp4|webm))/gi
  )

  return Array.from(new Set((matches ?? []).map(normalizeMediaLink)))
}

export function appendMediaToLastAssistant(messages: ChatMessage[], media: string[]): ChatMessage[] {
  if (media.length === 0) return messages

  const lastAssistantIndex = messages.findLastIndex((message) => message.role === 'assistant')
  if (lastAssistantIndex < 0) return messages

  const nextMessages = [...messages]
  const target = nextMessages[lastAssistantIndex]
  nextMessages[lastAssistantIndex] = {
    ...target,
    media: Array.from(new Set([...(target.media ?? []), ...media]))
  }

  return nextMessages
}
