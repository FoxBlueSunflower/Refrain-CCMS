import { describe, expect, it } from 'vitest'
import type { ResolveContext } from '../resolver/types'
import { findNestingViolations } from './nesting'

function ctx(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    variables: { product_name: { value: 'AcmeCloud', description: '' } },
    snippets: {},
    ...overrides,
  }
}

describe('findNestingViolations — variables (always allowed)', () => {
  it('does not flag a variable inside a table cell', () => {
    const text = '| Product | Version |\n| --- | --- |\n| {{product_name}} | 2.1 |'
    expect(findNestingViolations(text, ctx())).toEqual([])
  })

  it('does not flag a variable inside a blockquote', () => {
    expect(findNestingViolations('> Powered by {{product_name}}.', ctx())).toEqual([])
  })

  it('does not flag a variable inside a list item', () => {
    expect(findNestingViolations('- Powered by {{product_name}}.', ctx())).toEqual([])
  })
})

describe('findNestingViolations — single-line snippets (allowed)', () => {
  const single = ctx({ snippets: { 'short-phrase': '---\nname: short-phrase\n---\n\nRefrain CCMS\n' } })

  it('allows a single-line snippet inside a table cell', () => {
    const text = '| Product | Version |\n| --- | --- |\n| {{> short-phrase}} | 2.1 |'
    expect(findNestingViolations(text, single)).toEqual([])
  })

  it('allows a single-line snippet inside a blockquote', () => {
    expect(findNestingViolations('> {{> short-phrase}}', single)).toEqual([])
  })

  it('allows a single-line snippet inside a list item', () => {
    expect(findNestingViolations('- {{> short-phrase}}', single)).toEqual([])
  })
})

describe('findNestingViolations — multi-line snippets (disallowed)', () => {
  const multi = ctx({
    snippets: { changelog: '---\nname: changelog\n---\n\n# Changelog\n\nFirst line.\nSecond line.\n' },
  })

  it('flags a multi-line snippet inside a table cell with a message naming the multi-line problem', () => {
    const text = '| Product | Notes |\n| --- | --- |\n| Widget | {{> changelog}} |'
    const violations = findNestingViolations(text, multi)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ type: 'snippet-multiline-nested', context: 'table-cell' })
    expect(violations[0].message).toMatch(/multiple lines/i)
  })

  it('flags a multi-line snippet inside a blockquote', () => {
    const violations = findNestingViolations('> {{> changelog}}', multi)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ type: 'snippet-multiline-nested', context: 'blockquote' })
  })

  it('flags a multi-line snippet inside a list item', () => {
    const violations = findNestingViolations('- {{> changelog}}', multi)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ type: 'snippet-multiline-nested', context: 'list-item' })
  })

  it('does not flag a multi-line snippet used normally at the top level', () => {
    expect(findNestingViolations('Before.\n{{> changelog}}\nAfter.', multi)).toEqual([])
  })
})

describe('findNestingViolations — conditions nested in cell/blockquote/list-item (disallowed)', () => {
  it('flags a condition embedded inside a table cell', () => {
    const text = '| A | B |\n| --- | --- |\n| :::when audience=internal | x |'
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'table-cell')).toBe(true)
  })

  it('flags a condition fence prefixed by a blockquote marker', () => {
    const text = '> :::when audience=internal\n> Internal note.\n> :::'
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'blockquote')).toBe(true)
  })

  it('flags a condition fence prefixed by a list marker', () => {
    const text = '- :::when audience=internal\n- Internal note.\n- :::'
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'list-item')).toBe(true)
  })
})

describe('findNestingViolations — condition wraps a table row (disallowed)', () => {
  it('flags a fence wrapping one row of a larger table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', ':::when audience=internal', '| 3 | 4 |', ':::', '| 5 | 6 |'].join(
      '\n',
    )
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'table-row')).toBe(true)
  })

  it('does not flag a condition wrapping an entire table (fence lines outside the table on both sides)', () => {
    const text = [':::when audience=internal', '| A | B |', '| --- | --- |', '| 1 | 2 |', ':::'].join('\n')
    expect(findNestingViolations(text, ctx())).toEqual([])
  })
})

describe('findNestingViolations — condition inside condition (disallowed)', () => {
  it('flags a nested :::when fence inside another condition block', () => {
    const text = ':::when audience=internal\nLine A.\n:::when audience=partner\nLine B.\n:::\nLine C.\n:::'
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'condition-block')).toBe(true)
  })

  it('does not flag a normal, single top-level condition block', () => {
    const text = 'Before.\n:::when audience=internal\nInternal note.\n:::\nAfter.'
    expect(findNestingViolations(text, ctx())).toEqual([])
  })
})

describe('findNestingViolations — condition embedded in a snippet (disallowed)', () => {
  it('flags a snippet whose own source contains a condition block', () => {
    const gated = ctx({
      snippets: { gated: '---\nname: gated\n---\n\n:::when audience=internal\nSecret.\n:::\n' },
    })
    const violations = findNestingViolations('Before.\n{{> gated}}\nAfter.', gated)
    expect(violations.some((v) => v.type === 'condition-nested' && v.context === 'snippet')).toBe(true)
  })

  it('does not flag a snippet with no condition in its source', () => {
    const clean = ctx({ snippets: { clean: '---\nname: clean\n---\n\nJust text.\n' } })
    expect(findNestingViolations('{{> clean}}', clean)).toEqual([])
  })
})

describe('findNestingViolations — block content wedged into a table (disallowed)', () => {
  it('flags a bulleted list interposed inside a table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '- stray list item', '| 3 | 4 |'].join('\n')
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'block-breaks-table')).toBe(true)
  })

  it('flags a blockquote interposed inside a table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '> a quote', '| 3 | 4 |'].join('\n')
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'block-breaks-table')).toBe(true)
  })

  it('flags a fenced code block interposed inside a table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '```', 'code', '```', '| 3 | 4 |'].join('\n')
    const violations = findNestingViolations(text, ctx())
    expect(violations.some((v) => v.type === 'block-breaks-table')).toBe(true)
  })

  it('does not flag a normal, uninterrupted table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n')
    expect(findNestingViolations(text, ctx())).toEqual([])
  })

  it('does not flag a table that simply ends at a blank line followed by a paragraph', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '', 'Just a paragraph.'].join('\n')
    expect(findNestingViolations(text, ctx())).toEqual([])
  })
})

describe('findNestingViolations — fenced code blocks are exempt (literal, never flagged)', () => {
  it('does not flag app syntax shown literally as a documentation example inside a code fence', () => {
    const text = ['Here is an example:', '```', '{{product_name}}', '{{> some-snippet}}', ':::when audience=internal', ':::', '```'].join(
      '\n',
    )
    expect(findNestingViolations(text, ctx())).toEqual([])
  })

  it('does not misinterpret a table-cell-shaped line inside a code fence as breaking a real table', () => {
    const text = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '```', '| fake | row |', '```'].join('\n')
    expect(findNestingViolations(text, ctx())).toEqual([])
  })
})
