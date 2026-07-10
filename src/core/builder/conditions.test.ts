import { describe, expect, it } from 'vitest'
import type { ConditionsFile, PublishProfile } from '../workspace/types'
import { filterConditions } from './conditions'

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
})
