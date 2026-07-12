import { describe, expect, it } from 'vitest'
import type { PublicationNode } from './types'
import { flattenPublication } from './flatten'

describe('flattenPublication', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenPublication([])).toEqual([])
  })

  it('assigns level 1 to all top-level siblings', () => {
    const nodes: PublicationNode[] = [
      { type: 'heading', title: 'Intro' },
      { type: 'doc', ref: 'docs/a.md' },
      { type: 'doc', ref: 'docs/b.md' },
    ]
    const flat = flattenPublication(nodes)
    expect(flat).toEqual([
      { type: 'heading', level: 1, title: 'Intro', levelClamped: false },
      { type: 'doc', level: 1, ref: 'docs/a.md', levelClamped: false },
      { type: 'doc', level: 1, ref: 'docs/b.md', levelClamped: false },
    ])
  })

  it('nests children under a heading at depth + 1, while a sibling doc after that heading stays at the shallower depth', () => {
    const nodes: PublicationNode[] = [
      { type: 'heading', title: 'Getting Started' },
      { type: 'doc', ref: 'docs/getting-started.md' },
      {
        type: 'heading',
        title: 'Reference',
        children: [{ type: 'doc', ref: 'docs/faq.md' }],
      },
    ]
    const flat = flattenPublication(nodes)
    expect(flat).toEqual([
      { type: 'heading', level: 1, title: 'Getting Started', levelClamped: false },
      { type: 'doc', level: 1, ref: 'docs/getting-started.md', levelClamped: false },
      { type: 'heading', level: 1, title: 'Reference', levelClamped: false },
      { type: 'doc', level: 2, ref: 'docs/faq.md', levelClamped: false },
    ])
  })

  it('clamps depth beyond H6 and flags it', () => {
    let nodes: PublicationNode[] = [{ type: 'doc', ref: 'docs/deep.md' }]
    for (let i = 0; i < 6; i++) {
      nodes = [{ type: 'heading', title: `Level ${6 - i}`, children: nodes }]
    }
    const flat = flattenPublication(nodes)
    // 6 wrapping headings (depths 1-6) + the doc at depth 7, clamped to 6.
    expect(flat).toHaveLength(7)
    for (let i = 0; i < 6; i++) {
      expect(flat[i]).toMatchObject({ type: 'heading', level: i + 1, levelClamped: false })
    }
    expect(flat[6]).toEqual({ type: 'doc', level: 6, ref: 'docs/deep.md', levelClamped: true })
  })

  it('gives mixed doc/heading siblings at the same depth the same level', () => {
    const nodes: PublicationNode[] = [
      {
        type: 'heading',
        title: 'Section',
        children: [
          { type: 'doc', ref: 'docs/x.md' },
          { type: 'heading', title: 'Subsection' },
        ],
      },
    ]
    const flat = flattenPublication(nodes)
    expect(flat[1]).toEqual({ type: 'doc', level: 2, ref: 'docs/x.md', levelClamped: false })
    expect(flat[2]).toEqual({ type: 'heading', level: 2, title: 'Subsection', levelClamped: false })
  })
})
