import { describe, expect, it } from 'vitest'
import type { ConditionsFile, PublishProfile } from '../workspace/types'
import { annotateConditionBlocks, filterConditions, findConditionBlocks } from './conditions'

const conditionsFile: ConditionsFile = { audience: ['customer', 'internal'], output: ['web'] }

function profile(overrides: Partial<PublishProfile> = {}): PublishProfile {
  return { audience: ['customer'], output: ['web'], ...overrides }
}

describe('filterConditions', () => {
  it('keeps a block whose value is included in the active profile', () => {
    const text = 'Before.\n:::when audience=internal\nInternal note.\n:::\nAfter.'
    const result = filterConditions(text, 'docs/index.md', profile({ audience: ['customer', 'internal'] }), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Before.\nInternal note.\nAfter.')
  })

  it('excludes a recognized block whose value is not in the active profile, without warning', () => {
    const text = 'Before.\n:::when audience=internal\nInternal note.\n:::\nAfter.'
    const result = filterConditions(text, 'docs/index.md', profile({ audience: ['customer'] }), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Before.\nAfter.')
  })

  it('excludes and warns on an unrecognized condition dimension', () => {
    const text = ':::when platform=ios\nSecret.\n:::'
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([
      { type: 'unknown-condition-dimension', file: 'docs/index.md', line: 1, message: expect.any(String) },
    ])
    expect(result.text).toBe('')
  })

  it('excludes and warns on a value not listed in conditions.json', () => {
    const text = ':::when audience=partner\nSecret.\n:::'
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([
      { type: 'unknown-condition-value', file: 'docs/index.md', line: 1, message: expect.any(String) },
    ])
    expect(result.text).toBe('')
  })

  it('drops only the opening tag of an unclosed block, keeping the rest of the document', () => {
    const text = 'Start.\n:::when audience=internal\nDangling.'
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([
      { type: 'unclosed-condition-block', file: 'docs/index.md', line: 2, message: expect.any(String) },
    ])
    expect(result.text).toBe('Start.\nDangling.')
  })

  it('reports independent, correct line numbers for multiple blocks in one document', () => {
    const text = ':::when audience=foo\nA.\n:::\nMiddle.\n:::when audience=bar\nB.\n:::'
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([
      { type: 'unknown-condition-value', file: 'docs/index.md', line: 1, message: expect.any(String) },
      { type: 'unknown-condition-value', file: 'docs/index.md', line: 5, message: expect.any(String) },
    ])
    expect(result.text).toBe('Middle.')
  })

  it('treats an inner ":::when" line as inert body text of the outer block (no nesting support)', () => {
    const text = ':::when audience=internal\nLine A.\n:::when audience=partner\nLine B.\n:::\nLine C.\n:::'
    const result = filterConditions(text, 'docs/index.md', profile({ audience: ['customer', 'internal'] }), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toContain('Line A.')
    expect(result.text).toContain(':::when audience=partner')
    expect(result.text).toContain('Line B.')
    expect(result.text).toContain('Line C.')
  })

  it('leaves a document with no condition blocks unchanged', () => {
    const text = 'Just plain markdown, no tokens here.\n'
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe(text)
  })

  it('accepts and filters a wholly new, non-audience/output dimension — dimensions are user-defined, not a fixed set', () => {
    const text = 'Before.\n:::when region=us\nUS-only note.\n:::\nAfter.'
    const regionConditions: ConditionsFile = { region: ['us', 'eu'] }
    const regionProfile: PublishProfile = { region: ['us'] }
    const result = filterConditions(text, 'docs/index.md', regionProfile, regionConditions)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Before.\nUS-only note.\nAfter.')
  })

  it('excludes without warning a known dimension the active profile simply omits', () => {
    const text = 'Before.\n:::when region=us\nUS-only note.\n:::\nAfter.'
    const regionConditions: ConditionsFile = { region: ['us', 'eu'] }
    const result = filterConditions(text, 'docs/index.md', profile(), regionConditions)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Before.\nAfter.')
  })

  it('treats a ":::when"-looking line inside a fenced code block as a literal documentation example, not a real condition', () => {
    const text = ['Before.', '```', ':::when audience=internal', 'Example body.', ':::', '```', 'After.'].join('\n')
    const result = filterConditions(text, 'docs/index.md', profile(), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe(text)
  })

  it('still filters a real condition block outside the fence in the same document', () => {
    const text = [':::when audience=internal', 'Real note.', ':::', '```', ':::when audience=internal', '```'].join('\n')
    const result = filterConditions(text, 'docs/index.md', profile({ audience: ['customer'] }), conditionsFile)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe(['```', ':::when audience=internal', '```'].join('\n'))
  })
})

describe('annotateConditionBlocks', () => {
  it('wraps a well-formed block with leaf markers carrying the tag, keeping the body intact', () => {
    const text = 'Before.\n:::when audience=internal\nInternal note.\n:::\nAfter.'
    const result = annotateConditionBlocks(text)
    expect(result).toBe(
      [
        'Before.',
        '<div class="rf-condition-tag" data-when="audience=internal"></div>',
        '',
        'Internal note.',
        '<div class="rf-condition-end"></div>',
        '',
        'After.',
      ].join('\n'),
    )
  })

  it('surrounds each marker with a blank line so it forms its own HTML block instead of swallowing the body', () => {
    // Per CommonMark, a block-level <div> tag continues consuming lines verbatim
    // (no inline markdown parsing) until a blank line — without one, "Internal
    // note." would never become its own paragraph.
    const result = annotateConditionBlocks(':::when audience=internal\nInternal note.\n:::')
    const lines = result.split('\n')
    const tagIndex = lines.findIndex((line) => line.includes('rf-condition-tag'))
    const endIndex = lines.findIndex((line) => line.includes('rf-condition-end'))
    expect(lines[tagIndex + 1]).toBe('')
    expect(lines[endIndex + 1]).toBe('')
  })

  it('still labels a block with an unrecognized dimension or value (no validation here)', () => {
    const text = ':::when platform=ios\nSecret.\n:::'
    const result = annotateConditionBlocks(text)
    expect(result).toContain('data-when="platform=ios"')
    expect(result).toContain('Secret.')
  })

  it('leaves an unclosed block completely untouched', () => {
    const text = 'Start.\n:::when audience=internal\nDangling.'
    const result = annotateConditionBlocks(text)
    expect(result).toBe(text)
  })

  it('leaves a document with no condition blocks unchanged', () => {
    const text = 'Just plain markdown, no tokens here.\n'
    expect(annotateConditionBlocks(text)).toBe(text)
  })
})

describe('findConditionBlocks', () => {
  it('finds a single well-formed block and its fence line indices', () => {
    const text = 'Before.\n:::when audience=internal\nInternal note.\n:::\nAfter.'
    expect(findConditionBlocks(text)).toEqual([{ dimension: 'audience', value: 'internal', openLine: 1, closeLine: 3 }])
  })

  it('finds multiple independent blocks in one document', () => {
    const text = ':::when audience=foo\nA.\n:::\nMiddle.\n:::when audience=bar\nB.\n:::'
    expect(findConditionBlocks(text)).toEqual([
      { dimension: 'audience', value: 'foo', openLine: 0, closeLine: 2 },
      { dimension: 'audience', value: 'bar', openLine: 4, closeLine: 6 },
    ])
  })

  it('omits an unclosed block', () => {
    const text = 'Start.\n:::when audience=internal\nDangling.'
    expect(findConditionBlocks(text)).toEqual([])
  })

  it('reports a block whose dimension/value is not in conditions.json (well-formedness only, no validation)', () => {
    const text = ':::when platform=ios\nSecret.\n:::'
    expect(findConditionBlocks(text)).toEqual([{ dimension: 'platform', value: 'ios', openLine: 0, closeLine: 2 }])
  })

  it('returns an empty array for a document with no condition blocks', () => {
    expect(findConditionBlocks('Just plain markdown, no tokens here.\n')).toEqual([])
  })
})
