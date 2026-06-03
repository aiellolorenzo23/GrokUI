import { describe, expect, it } from 'vitest'
import {
  attachMediaToMessages,
  createChatMessage,
  extractMediaLinks,
  mediaPreviewSrc,
  transcriptToMessages
} from './chat'

describe('attachMediaToMessages', () => {
  it('attaches media only to messages that reference the exact item', () => {
    const messages = [
      createChatMessage('user', 'File attachments:\nC:\\Users\\me\\input.png'),
      createChatMessage('assistant', 'Created image at file:///C:/Users/me/output-1.png'),
      createChatMessage('assistant', 'Created image at file:///C:/Users/me/output-2.png')
    ]

    const result = attachMediaToMessages(messages, [
      'C:\\Users\\me\\input.png',
      'file:///C:/Users/me/output-1.png',
      'file:///C:/Users/me/output-2.png',
      'file:///C:/Users/me/unmatched.png'
    ])

    expect(result[0].media).toEqual(['C:\\Users\\me\\input.png'])
    expect(result[1].media).toEqual(['file:///C:/Users/me/output-1.png'])
    expect(result[2].media).toEqual(['file:///C:/Users/me/output-2.png'])
    expect(
      result.some((message) => message.media?.includes('file:///C:/Users/me/unmatched.png'))
    ).toBe(false)
  })
})

describe('transcriptToMessages', () => {
  it('keeps media anchored to the message that mentions it when reopening a session', () => {
    const transcript = [
      '## User',
      'File attachments:',
      'C:\\Users\\me\\input-a.png',
      '',
      '## Assistant',
      'Generated file:///C:/Users/me/out-a.png',
      '',
      '## User',
      'File attachments:',
      'C:\\Users\\me\\input-b.png',
      '',
      '## Assistant',
      'Generated file:///C:/Users/me/out-b.png'
    ].join('\n')

    const messages = transcriptToMessages(transcript, [
      'C:\\Users\\me\\input-a.png',
      'file:///C:/Users/me/out-a.png',
      'C:\\Users\\me\\input-b.png',
      'file:///C:/Users/me/out-b.png'
    ])

    expect(messages).toHaveLength(4)
    expect(messages[0].media).toEqual(['C:\\Users\\me\\input-a.png'])
    expect(messages[1].media).toEqual(['file:///C:/Users/me/out-a.png'])
    expect(messages[2].media).toEqual(['C:\\Users\\me\\input-b.png'])
    expect(messages[3].media).toEqual(['file:///C:/Users/me/out-b.png'])
  })
})

describe('extractMediaLinks', () => {
  it('extracts generic local file paths, not only images and videos', () => {
    const text = [
      'Created files:',
      'C:\\Users\\lollo\\w-la-figa-fluo.html',
      'C:\\Users\\lollo\\notes final.txt',
      'file:///C:/Users/lollo/Documents/output.pdf'
    ].join('\n')

    expect(extractMediaLinks(text)).toEqual([
      'C:\\Users\\lollo\\w-la-figa-fluo.html',
      'C:\\Users\\lollo\\notes final.txt',
      'file:///C:/Users/lollo/Documents/output.pdf'
    ])
  })

  it('does not treat web urls as local files', () => {
    const text = [
      'Link font:',
      'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap',
      'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
      'https://example.com/archive/report.json?download=1',
      'https://example.com'
    ].join('\n')

    expect(extractMediaLinks(text)).toEqual([])
  })
})

describe('createChatMessage', () => {
  it('stores generic file references so the UI can render file cards', () => {
    const message = createChatMessage(
      'assistant',
      'Fatto. File creato in C:\\Users\\lollo\\w-la-figa-fluo.html'
    )

    expect(message.mediaLinks).toEqual(['C:\\Users\\lollo\\w-la-figa-fluo.html'])
  })
})

describe('mediaPreviewSrc', () => {
  it('converts local media paths to the custom app protocol for inline previews', () => {
    expect(mediaPreviewSrc('C:\\Users\\me\\image 1.png')).toBe(
      'grokui-media://local/C%3A%5CUsers%5Cme%5Cimage%201.png'
    )
    expect(mediaPreviewSrc('file:///C:/Users/me/image 1.png')).toBe(
      'grokui-media://local/file%3A%2F%2F%2FC%3A%2FUsers%2Fme%2Fimage%201.png'
    )
  })
})
