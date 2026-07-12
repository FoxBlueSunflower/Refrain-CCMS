import { describe, expect, it } from 'vitest'
import { buildBoldInsertion, buildItalicInsertion, buildUnderlineInsertion } from './inlineEditing'

describe('buildBoldInsertion', () => {
  it('inserts bare markers with the cursor between them when nothing is selected', () => {
    const doc = 'Hello world.'
    const result = buildBoldInsertion(doc, 5, 5)
    expect(result.insertText).toBe('****')
    expect(result.insertText.slice(0, result.cursorPos)).toBe('**')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Hello**** world.')
  })

  it('wraps a non-empty selection in place, cursor after the closing marker', () => {
    const doc = 'Hello world.'
    const from = doc.indexOf('world')
    const to = from + 'world'.length
    const result = buildBoldInsertion(doc, from, to)
    expect(result.insertText).toBe('**world**')
    expect(result.cursorPos).toBe(result.insertText.length)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Hello **world**.')
  })
})

describe('buildItalicInsertion', () => {
  it('inserts bare markers with the cursor between them when nothing is selected', () => {
    const result = buildItalicInsertion('', 0, 0)
    expect(result.insertText).toBe('**')
    expect(result.insertText.slice(0, result.cursorPos)).toBe('*')
  })

  it('wraps a non-empty selection', () => {
    const doc = 'emphasis'
    const result = buildItalicInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('*emphasis*')
  })
})

describe('buildUnderlineInsertion', () => {
  it('inserts bare HTML markers with the cursor between them when nothing is selected', () => {
    const result = buildUnderlineInsertion('', 0, 0)
    expect(result.insertText).toBe('<u></u>')
    expect(result.insertText.slice(0, result.cursorPos)).toBe('<u>')
  })

  it('wraps a non-empty selection in <u> tags', () => {
    const doc = 'important'
    const result = buildUnderlineInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('<u>important</u>')
    expect(result.cursorPos).toBe(result.insertText.length)
  })
})
