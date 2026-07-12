import { describe, expect, it } from 'vitest'
import {
  buildBlockquoteInsertion,
  buildBulletListInsertion,
  buildChecklistInsertion,
  buildCodeBlockInsertion,
  buildHorizontalRuleInsertion,
  buildNumberedListInsertion,
  buildSpaceInsertion,
  buildSubheadingInsertion,
  buildTableInsertion,
} from './blockEditing'

describe('buildBulletListInsertion', () => {
  it('prefixes the current (empty) line when nothing is selected', () => {
    const doc = ''
    const result = buildBulletListInsertion(doc, 0, 0)
    expect(result.insertText).toBe('- ')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('- ')
  })

  it('snaps a mid-line cursor out to the whole line before prefixing', () => {
    const doc = 'Some text here.'
    const result = buildBulletListInsertion(doc, 5, 5)
    expect(result.from).toBe(0)
    expect(result.to).toBe(doc.length)
    expect(result.insertText).toBe('- Some text here.')
  })

  it('prefixes every line touched by a multi-line selection', () => {
    const doc = 'First line\nSecond line\nThird line'
    const from = doc.indexOf('Second')
    const to = doc.indexOf('Third') + 'Third'.length
    const result = buildBulletListInsertion(doc, from, to)
    expect(result.insertText).toBe('- Second line\n- Third line')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('First line\n- Second line\n- Third line')
  })
})

describe('buildNumberedListInsertion', () => {
  it('numbers each line sequentially starting at 1', () => {
    const doc = 'One\nTwo\nThree'
    const result = buildNumberedListInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('1. One\n2. Two\n3. Three')
  })
})

describe('buildBlockquoteInsertion', () => {
  it('prefixes a single line with "> "', () => {
    const doc = 'A quote.'
    const result = buildBlockquoteInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('> A quote.')
  })

  it('prefixes every line of a multi-line quote', () => {
    const doc = 'Line one.\nLine two.'
    const result = buildBlockquoteInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('> Line one.\n> Line two.')
  })
})

describe('buildCodeBlockInsertion', () => {
  it('inserts a blank fenced scaffold with the cursor on the blank body line when nothing is selected', () => {
    const doc = 'Hello world.'
    const result = buildCodeBlockInsertion(doc, 5, 5)
    expect(result.insertText).toBe('```\n\n```\n')
    expect(result.insertText.slice(0, result.cursorPos)).toBe('```\n')
  })

  it('wraps a selected line in backtick fences', () => {
    const doc = 'const x = 1;'
    const result = buildCodeBlockInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('```\nconst x = 1;\n```')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('```\nconst x = 1;\n```')
  })
})

describe('buildChecklistInsertion', () => {
  it('prefixes a single line with "- [ ] "', () => {
    const doc = 'Buy milk'
    const result = buildChecklistInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('- [ ] Buy milk')
  })

  it('prefixes every line of a multi-line selection', () => {
    const doc = 'First\nSecond'
    const result = buildChecklistInsertion(doc, 0, doc.length)
    expect(result.insertText).toBe('- [ ] First\n- [ ] Second')
  })
})

describe('buildSubheadingInsertion', () => {
  it('prefixes the current (empty) line with "## " when nothing is selected', () => {
    const doc = ''
    const result = buildSubheadingInsertion(doc, 0)
    expect(result.insertText).toBe('## ')
  })

  it('snaps a mid-line cursor out to the whole line before prefixing', () => {
    const doc = 'Section title'
    const result = buildSubheadingInsertion(doc, 5)
    expect(result.from).toBe(0)
    expect(result.to).toBe(doc.length)
    expect(result.insertText).toBe('## Section title')
  })

  it('only prefixes the line containing `from`, ignoring the rest of a multi-line document', () => {
    const doc = 'First line\nSecond line\nThird line'
    const from = doc.indexOf('Second')
    const result = buildSubheadingInsertion(doc, from)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('First line\n## Second line\nThird line')
  })
})

describe('buildTableInsertion', () => {
  it('inserts a bare table template at the start of an empty document', () => {
    const doc = ''
    const result = buildTableInsertion(doc, 0, 0)
    expect(result.insertText).toBe('| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |')
  })

  it('pads with a blank line before a table inserted right after paragraph text (no trailing newline)', () => {
    const doc = 'Some text.'
    const result = buildTableInsertion(doc, doc.length, doc.length)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Some text.\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |')
  })

  it('replaces a non-empty selection rather than wrapping it', () => {
    const doc = 'Before SELECTED After'
    const from = doc.indexOf('SELECTED')
    const to = from + 'SELECTED'.length
    const result = buildTableInsertion(doc, from, to)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Before \n\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n\n After')
  })
})

describe('buildHorizontalRuleInsertion', () => {
  it('inserts a bare rule at the very start of an empty document', () => {
    const doc = ''
    const result = buildHorizontalRuleInsertion(doc, 0, 0)
    expect(result.insertText).toBe('---')
  })

  it('pads with a blank line before a rule inserted right after paragraph text (no trailing newline)', () => {
    const doc = 'Some text.'
    const result = buildHorizontalRuleInsertion(doc, doc.length, doc.length)
    expect(result.insertText).toBe('\n\n---')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Some text.\n\n---')
  })

  it('adds only one newline when already at the start of a fresh (non-blank) line', () => {
    const doc = 'Some text.\n'
    const result = buildHorizontalRuleInsertion(doc, doc.length, doc.length)
    expect(result.insertText).toBe('\n---')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Some text.\n\n---')
  })

  it('adds no padding when already separated by a blank line', () => {
    const doc = 'Some text.\n\n'
    const result = buildHorizontalRuleInsertion(doc, doc.length, doc.length)
    expect(result.insertText).toBe('---')
  })

  it('pads on both sides when inserted in the middle of a document with adjacent text', () => {
    const doc = 'Before.\nAfter.'
    const from = doc.indexOf('\nAfter') + 1 // right before "After.", one newline already precedes it
    const result = buildHorizontalRuleInsertion(doc, from, from)
    expect(result.insertText).toBe('\n---\n\n')
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Before.\n\n---\n\nAfter.')
  })

  it('replaces a non-empty selection rather than wrapping it', () => {
    const doc = 'Before SELECTED After'
    const from = doc.indexOf('SELECTED')
    const to = from + 'SELECTED'.length
    const result = buildHorizontalRuleInsertion(doc, from, to)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Before \n\n---\n\n After')
  })
})

describe('buildSpaceInsertion', () => {
  it('inserts a blank line at the very start of an empty document', () => {
    const result = buildSpaceInsertion(0, 0)
    expect(result.insertText).toBe('\n\n')
  })

  it('inserts a blank line right after text with no trailing newline', () => {
    const doc = 'Some text.'
    const result = buildSpaceInsertion(doc.length, doc.length)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Some text.\n\n')
  })

  it('discards a non-empty selection rather than wrapping it', () => {
    const doc = 'Before SELECTED After'
    const from = doc.indexOf('SELECTED')
    const to = from + 'SELECTED'.length
    const result = buildSpaceInsertion(from, to)
    const combined = doc.slice(0, result.from) + result.insertText + doc.slice(result.to)
    expect(combined).toBe('Before \n\n After')
  })
})
