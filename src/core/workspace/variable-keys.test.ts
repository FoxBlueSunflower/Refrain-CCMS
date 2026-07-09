import { describe, expect, it } from 'vitest'
import { isValidVariableKey, validateVariableKeys } from './variable-keys'

describe('isValidVariableKey', () => {
  it('accepts letters, digits, underscores, and hyphens', () => {
    expect(isValidVariableKey('product_name')).toBe(true)
    expect(isValidVariableKey('Version-2')).toBe(true)
    expect(isValidVariableKey('a')).toBe(true)
  })

  it('rejects empty, spaces, slashes, and non-ASCII characters', () => {
    expect(isValidVariableKey('')).toBe(false)
    expect(isValidVariableKey('has space')).toBe(false)
    expect(isValidVariableKey('slash/in/key')).toBe(false)
    expect(isValidVariableKey('emoji😀')).toBe(false)
  })
})

describe('validateVariableKeys', () => {
  it('returns an empty map for no candidates', () => {
    expect(validateVariableKeys([])).toEqual(new Map())
  })

  it('returns an empty map when all keys are unique and valid', () => {
    const result = validateVariableKeys([
      { id: '1', key: 'product_name' },
      { id: '2', key: 'version' },
    ])
    expect(result).toEqual(new Map())
  })

  it('flags an empty key on only that row', () => {
    const result = validateVariableKeys([
      { id: '1', key: '' },
      { id: '2', key: 'version' },
    ])
    expect(result).toEqual(new Map([['1', ['empty']]]))
  })

  it('treats a whitespace-only key as empty, not malformed', () => {
    const result = validateVariableKeys([{ id: '1', key: '   ' }])
    expect(result).toEqual(new Map([['1', ['empty']]]))
  })

  it('flags a malformed key', () => {
    const result = validateVariableKeys([{ id: '1', key: 'has space' }])
    expect(result).toEqual(new Map([['1', ['invalid-format']]]))
  })

  it('flags duplicate keys on both rows, not just the second', () => {
    const result = validateVariableKeys([
      { id: '1', key: 'dup' },
      { id: '2', key: 'unique' },
      { id: '3', key: 'dup' },
    ])
    expect(result).toEqual(
      new Map([
        ['1', ['duplicate']],
        ['3', ['duplicate']],
      ]),
    )
  })

  it('treats keys as duplicates after trimming surrounding whitespace', () => {
    const result = validateVariableKeys([
      { id: '1', key: 'foo' },
      { id: '2', key: ' foo ' },
    ])
    expect(result).toEqual(
      new Map([
        ['1', ['duplicate']],
        ['2', ['duplicate']],
      ]),
    )
  })

  it('reports both invalid-format and duplicate on the same row when applicable', () => {
    const result = validateVariableKeys([
      { id: '1', key: 'bad key' },
      { id: '2', key: 'bad key' },
    ])
    expect(result.get('1')).toEqual(['invalid-format', 'duplicate'])
    expect(result.get('2')).toEqual(['invalid-format', 'duplicate'])
  })
})
