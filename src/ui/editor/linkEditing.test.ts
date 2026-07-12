import { describe, expect, it } from 'vitest'
import { buildLinkInsertion } from './linkEditing'

describe('buildLinkInsertion', () => {
  it('inserts empty brackets with the cursor between them when nothing is selected', () => {
    const doc = 'Hello world.'
    const result = buildLinkInsertion(doc, 5, 5, 'https://example.com')
    expect(result.insertText).toBe('[](https://example.com)')
    expect(result.insertText.slice(0, result.cursorPos)).toBe('[')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Hello[](https://example.com) world.')
  })

  it('wraps a non-empty selection as the link text, cursor after the closing paren', () => {
    const doc = 'See the docs page.'
    const from = doc.indexOf('docs')
    const to = from + 'docs'.length
    const result = buildLinkInsertion(doc, from, to, 'guide.md')
    expect(result.insertText).toBe('[docs](guide.md)')
    expect(result.cursorPos).toBe(result.insertText.length)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('See the [docs](guide.md) page.')
  })

  it('works identically for a doc-relative internal target', () => {
    const doc = 'Selected'
    const result = buildLinkInsertion(doc, 0, doc.length, 'other-doc.md')
    expect(result.insertText).toBe('[Selected](other-doc.md)')
  })
})
