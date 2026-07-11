import { describe, expect, it } from 'vitest'
import { FRONTMATTER_SCHEMA, isKnownFrontmatterKey, knownFrontmatterKeys } from './schema'

describe('FRONTMATTER_SCHEMA', () => {
  it('scopes document fields to exactly title, description, order', () => {
    expect(FRONTMATTER_SCHEMA.document.map((f) => f.key)).toEqual(['title', 'description', 'order'])
  })

  it('scopes snippet fields to exactly name, description, forked_from, forked_from_snapshot', () => {
    expect(FRONTMATTER_SCHEMA.snippet.map((f) => f.key)).toEqual([
      'name',
      'description',
      'forked_from',
      'forked_from_snapshot',
    ])
  })
})

describe('knownFrontmatterKeys', () => {
  it('returns the document key list', () => {
    expect(knownFrontmatterKeys('document')).toEqual(['title', 'description', 'order'])
  })

  it('returns the snippet key list', () => {
    expect(knownFrontmatterKeys('snippet')).toEqual(['name', 'description', 'forked_from', 'forked_from_snapshot'])
  })
})

describe('isKnownFrontmatterKey', () => {
  it('is true for a document field', () => {
    expect(isKnownFrontmatterKey('document', 'title')).toBe(true)
  })

  it('is true for a snippet field', () => {
    expect(isKnownFrontmatterKey('snippet', 'forked_from')).toBe(true)
  })

  it('is false for an unrecognized key', () => {
    expect(isKnownFrontmatterKey('document', 'custom_field')).toBe(false)
  })

  it('is false for "when", which is SPEC-documented but has no runtime consumer yet', () => {
    expect(isKnownFrontmatterKey('document', 'when')).toBe(false)
  })

  it('is false for speculative fields not in SPEC.md (tags, status)', () => {
    expect(isKnownFrontmatterKey('document', 'tags')).toBe(false)
    expect(isKnownFrontmatterKey('document', 'status')).toBe(false)
  })

  it('does not cross-contaminate keys between entry kinds', () => {
    expect(isKnownFrontmatterKey('document', 'name')).toBe(false)
    expect(isKnownFrontmatterKey('snippet', 'title')).toBe(false)
  })
})
