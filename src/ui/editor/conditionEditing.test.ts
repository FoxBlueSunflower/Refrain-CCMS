import { describe, expect, it } from 'vitest'
import { buildConditionInsertion } from './conditionEditing'

describe('buildConditionInsertion', () => {
  it('inserts a blank scaffold with the cursor on the blank body line when nothing is selected', () => {
    const doc = 'Hello world.'
    const result = buildConditionInsertion(doc, 5, 5, 'audience', 'internal')
    expect(result.from).toBe(5)
    expect(result.to).toBe(5)
    expect(result.insertText).toBe(':::when audience=internal\n\n:::\n')
    // cursor lands right after the opening fence's newline, on the blank body line
    expect(result.insertText.slice(0, result.cursorPos)).toBe(':::when audience=internal\n')
  })

  it('snaps a mid-line word selection out to the whole line, so the rest of the sentence is not left dangling on a separate fragment line', () => {
    const doc = 'Before SELECTED After'
    const from = doc.indexOf('SELECTED')
    const to = from + 'SELECTED'.length
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.from).toBe(0)
    expect(result.to).toBe(doc.length)
    expect(result.insertText).toBe(':::when audience=internal\nBefore SELECTED After\n:::')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe(':::when audience=internal\nBefore SELECTED After\n:::')
  })

  it('snaps a selection spanning part of two lines out to cover both lines fully', () => {
    const doc = 'Line one here.\nLine two here.\nLine three.'
    const from = doc.indexOf('one')
    const to = doc.indexOf('two') + 'two'.length
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    const firstLineStart = doc.indexOf('Line one')
    const secondLineEnd = doc.indexOf('Line three.') - 1 // end of "Line two here." (excludes its newline)
    expect(result.from).toBe(firstLineStart)
    expect(result.to).toBe(secondLineEnd)
    expect(result.insertText).toBe(':::when audience=internal\nLine one here.\nLine two here.\n:::')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe(':::when audience=internal\nLine one here.\nLine two here.\n:::\nLine three.')
  })

  it('wraps a selection that already spans a whole line without adding extra newlines (no-op snapping)', () => {
    const doc = 'Before.\nSelected line.\nAfter.'
    const from = doc.indexOf('Selected line.')
    const to = from + 'Selected line.'.length
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.from).toBe(from)
    expect(result.to).toBe(to)
    expect(result.insertText).toBe(':::when audience=internal\nSelected line.\n:::')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Before.\n:::when audience=internal\nSelected line.\n:::\nAfter.')
  })

  it('does not double the newline already inside the selection, but still separates the fence from trailing content', () => {
    const doc = 'Selected line.\nAfter.'
    const from = 0
    const to = doc.indexOf('\n') + 1 // include the trailing newline in the selection
    const result = buildConditionInsertion(doc, from, to, 'audience', 'internal')
    expect(result.from).toBe(from)
    expect(result.to).toBe(to)
    expect(result.insertText).toBe(':::when audience=internal\nSelected line.\n:::\n')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe(':::when audience=internal\nSelected line.\n:::\nAfter.')
  })

  it('places the cursor at the end of the inserted text for a non-empty selection', () => {
    const doc = 'Selected'
    const result = buildConditionInsertion(doc, 0, doc.length, 'audience', 'internal')
    expect(result.cursorPos).toBe(result.insertText.length)
  })
})
