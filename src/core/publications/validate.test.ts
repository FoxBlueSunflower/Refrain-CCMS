import { describe, expect, it } from 'vitest'
import { validatePublication } from './validate'

describe('validatePublication', () => {
  it('accepts the SPEC.md example tree', () => {
    const result = validatePublication({
      title: 'User Guide',
      nodes: [
        { type: 'heading', title: 'Getting Started' },
        { type: 'doc', ref: 'docs/getting-started.md' },
        { type: 'doc', ref: 'docs/guides/installation.md' },
        {
          type: 'heading',
          title: 'Reference',
          children: [{ type: 'doc', ref: 'docs/faq.md' }],
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.title).toBe('User Guide')
      expect(result.value.nodes).toHaveLength(4)
      expect(result.value.nodes[3]).toEqual({
        type: 'heading',
        title: 'Reference',
        children: [{ type: 'doc', ref: 'docs/faq.md' }],
      })
    }
  })

  it('accepts an empty tree', () => {
    const result = validatePublication({ title: 'Untitled', nodes: [] })
    expect(result.ok).toBe(true)
  })

  it('rejects a non-object', () => {
    const result = validatePublication('not an object')
    expect(result.ok).toBe(false)
  })

  it('rejects a missing title', () => {
    const result = validatePublication({ nodes: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('title'))).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = validatePublication({ title: '', nodes: [] })
    expect(result.ok).toBe(false)
  })

  it('rejects nodes that is not an array', () => {
    const result = validatePublication({ title: 'X', nodes: {} })
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown node type', () => {
    const result = validatePublication({ title: 'X', nodes: [{ type: 'paragraph' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('nodes[0]'))).toBe(true)
  })

  it('rejects a doc node missing ref', () => {
    const result = validatePublication({ title: 'X', nodes: [{ type: 'doc' }] })
    expect(result.ok).toBe(false)
  })

  it('rejects a heading node missing title', () => {
    const result = validatePublication({ title: 'X', nodes: [{ type: 'heading' }] })
    expect(result.ok).toBe(false)
  })

  it('rejects malformed children (not an array)', () => {
    const result = validatePublication({
      title: 'X',
      nodes: [{ type: 'heading', title: 'H', children: 'not-an-array' }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid node nested inside children', () => {
    const result = validatePublication({
      title: 'X',
      nodes: [{ type: 'heading', title: 'H', children: [{ type: 'doc' }] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('nodes[0].children[0]'))).toBe(true)
  })

  it('accepts a heading node with no children field', () => {
    const result = validatePublication({ title: 'X', nodes: [{ type: 'heading', title: 'H' }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nodes[0]).toEqual({ type: 'heading', title: 'H' })
  })

  it('accepts a doc node with a children array', () => {
    const result = validatePublication({
      title: 'X',
      nodes: [{ type: 'doc', ref: 'docs/a.md', children: [{ type: 'doc', ref: 'docs/b.md' }] }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nodes[0]).toEqual({
        type: 'doc',
        ref: 'docs/a.md',
        children: [{ type: 'doc', ref: 'docs/b.md' }],
      })
    }
  })

  it('rejects malformed children on a doc node (not an array)', () => {
    const result = validatePublication({
      title: 'X',
      nodes: [{ type: 'doc', ref: 'docs/a.md', children: 'not-an-array' }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid node nested inside a doc node\'s children', () => {
    const result = validatePublication({
      title: 'X',
      nodes: [{ type: 'doc', ref: 'docs/a.md', children: [{ type: 'doc' }] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('nodes[0].children[0]'))).toBe(true)
  })
})
