import { describe, expect, it } from 'vitest'
import { computeReorder, isPathWithin } from './reorder'

describe('isPathWithin', () => {
  it('is true for the same path', () => {
    expect(isPathWithin('docs/guides', 'docs/guides')).toBe(true)
  })

  it('is true for a nested descendant', () => {
    expect(isPathWithin('docs/guides', 'docs/guides/advanced')).toBe(true)
  })

  it('is false for an unrelated sibling with a shared prefix', () => {
    expect(isPathWithin('docs/guides', 'docs/guides-extra')).toBe(false)
  })

  it('is false for an unrelated path', () => {
    expect(isPathWithin('docs/guides', 'docs/other')).toBe(false)
  })
})

describe('computeReorder', () => {
  it('inserts a new item at the start', () => {
    expect(computeReorder(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  })

  it('inserts a new item in the middle', () => {
    expect(computeReorder(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  })

  it('inserts a new item at the end', () => {
    expect(computeReorder(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  })

  it('is a no-op when the item is already at the target position', () => {
    expect(computeReorder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  })

  it('clamps an out-of-range target index to the end', () => {
    expect(computeReorder(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
  })

  it('inserts a path not already present', () => {
    expect(computeReorder(['a', 'b'], 'new', 1)).toEqual(['a', 'new', 'b'])
  })
})
