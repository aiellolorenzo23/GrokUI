import { describe, expect, it } from 'vitest'
import {
  parseInlineTokens,
  parseMarkdownBlocks,
  parseTableAlignments,
  unescapeMarkdownText
} from './markdown'

describe('unescapeMarkdownText', () => {
  it('removes markdown escape characters for supported punctuation', () => {
    expect(unescapeMarkdownText(String.raw`\*\*bold\*\* \[link\] \~\~x\~\~`)).toBe('**bold** [link] ~~x~~')
  })
})

describe('parseInlineTokens', () => {
  it('parses code, strong text, markdown links, markdown images, raw urls and windows paths', () => {
    expect(
      parseInlineTokens(
        'Use `npm run dev`, open __README__, *focus* and ~~trim~~, see ![preview](file:///C:/tmp/test.png), visit <https://example.com> and C:\\Users\\lollo\\file.txt or [docs](https://docs.example.com).'
      )
    ).toEqual([
      { type: 'text', value: 'Use ' },
      { type: 'code', value: 'npm run dev' },
      { type: 'text', value: ', open ' },
      { type: 'strong', value: 'README' },
      { type: 'text', value: ', ' },
      { type: 'emphasis', value: 'focus' },
      { type: 'text', value: ' and ' },
      { type: 'strike', value: 'trim' },
      { type: 'text', value: ', see ' },
      { type: 'image', alt: 'preview', target: 'file:///C:/tmp/test.png' },
      { type: 'text', value: ', visit ' },
      { type: 'link', value: 'https://example.com', target: 'https://example.com' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'C:\\Users\\lollo\\file.txt', target: 'C:\\Users\\lollo\\file.txt' },
      { type: 'text', value: ' or ' },
      { type: 'markdown-link', value: 'docs', target: 'https://docs.example.com' },
      { type: 'text', value: '.' }
    ])
  })

  it('keeps trailing punctuation outside raw links', () => {
    expect(parseInlineTokens('See https://example.com, now.')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com', target: 'https://example.com' },
      { type: 'text', value: ', now.' }
    ])
  })
})

describe('parseMarkdownBlocks', () => {
  it('parses headings, paragraphs and fenced code blocks', () => {
    expect(
      parseMarkdownBlocks(
        ['Title', '===', '', 'Body line', '', '---', '', '~~~ts', 'const x = 1', '~~~'].join('\n')
      )
    ).toEqual([
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'Body line' },
      { type: 'rule' },
      { type: 'code', language: 'ts', code: 'const x = 1' }
    ])
  })

  it('parses quotes, task lists and ordered lists', () => {
    expect(
      parseMarkdownBlocks(
        [
          '> one',
          '> two',
          '',
          '- [x] done',
          '  extra context',
          '- [ ] todo',
          '',
          '1. first',
          '2) second'
        ].join('\n')
      )
    ).toEqual([
      { type: 'quote', lines: ['one', 'two'] },
      {
        type: 'list',
        ordered: false,
        items: [
          { text: 'done\nextra context', checked: true },
          { text: 'todo', checked: false }
        ]
      },
      {
        type: 'list',
        ordered: true,
        items: [{ text: 'first' }, { text: 'second' }]
      }
    ])
  })

  it('parses tables with alignments', () => {
    expect(
      parseMarkdownBlocks(
        ['Name | Count | State', ':--- | ---: | :---:', 'Grok | 2 | ok', 'Agent | 4 | run'].join('\n')
      )
    ).toEqual([
      {
        type: 'table',
        headers: ['Name', 'Count', 'State'],
        alignments: ['left', 'right', 'center'],
        rows: [
          ['Grok', '2', 'ok'],
          ['Agent', '4', 'run']
        ]
      }
    ])
  })
})

describe('parseTableAlignments', () => {
  it('detects left, right and center alignment markers', () => {
    expect(parseTableAlignments('| :--- | ---: | :---: | --- |')).toEqual([
      'left',
      'right',
      'center',
      undefined
    ])
  })
})
