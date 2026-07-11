import { describe, expect, it } from 'vitest'
import { buildConditionInsertion } from './conditionEditing'

describe('buildConditionInsertion', () => {
  it('inserts a blank scaffold with the cursor on the blank body line when nothing is selected', () => {
    const doc = 'Hello world.'
    const result = buildConditionInsertion(doc, 5, 5, 'audience', 'internal')
    expect(result.insertText).toBe(':::when audience=internal\n\n:::\n')
    // cursor lands right after the opening fence's newline, on the blank body line
    expect(result.insertText.slice(0, result.cursorPos)).toBe(':::when audience=internal\n')
  })

  it('wraps a mid-line selection, adding leading and trailing newlines to keep the fences bare', () => {
    const doc = 'Before SELECTED After'
    const from = doc.indexOf('SELECTED')
    const to = from + 'SELECTED'.length
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.insertText).toBe('\n:::when audience=internal\nSELECTED\n:::\n')
    const combined = doc.slice(0, from) + result.insertText + doc.slice(to)
    expect(combined).toBe('Before \n:::when audience=internal\nSELECTED\n:::\n After')
  })

  it('wraps a selection that already spans a whole line without adding extra newlines', () => {
    const doc = 'Before.\nSelected line.\nAfter.'
    const from = doc.indexOf('Selected line.')
    const to = from + 'Selected line.'.length
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.insertText).toBe(':::when audience=internal\nSelected line.\n:::')
    const combined = doc.slice(0, from) + result.insertText + doc.slice(to)
    expect(combined).toBe('Before.\n:::when audience=internal\nSelected line.\n:::\nAfter.')
  })

  it('does not double the newline already inside the selection, but still separates the fence from trailing content', () => {
    const doc = 'Selected line.\nAfter.'
    const from = 0
    const to = doc.indexOf('\n') + 1 // include the trailing newline in the selection
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.insertText).toBe(':::when audience=internal\nSelected line.\n:::\n')
    const combined = doc.slice(0, from) + result.insertText + doc.slice(to)
    expect(combined).toBe(':::when audience=internal\nSelected line.\n:::\nAfter.')
  })

  it('places the cursor at the end of the inserted text for a non-empty selection', () => {
    const doc = 'Selected'
    const result = buildConditionInsertion(doc, 0, doc.length, 'audience', 'internal')
    expect(result.cursorPos).toBe(result.insertText.length)
  })
})
