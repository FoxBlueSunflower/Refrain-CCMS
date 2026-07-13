import { describe, expect, it } from 'vitest'
import { collectDocRefs, countNodes } from './tree'
import type { PublicationNode } from './types'

describe('collectDocRefs', () => {
  it('returns an empty list for an empty tree', () => {
    expect(collectDocRefs([])).toEqual([])
  })

  it('collects refs from a flat list of doc nodes', () => {
    const nodes: PublicationNode[] = [
      { type: 'doc', ref: 'docs/a.md' },
      { type: 'doc', ref: 'docs/b.md' },
    ]
    expect(collectDocRefs(nodes)).toEqual(['docs/a.md', 'docs/b.md'])
  })

  it('ignores heading nodes with no doc descendants', () => {
    const nodes: PublicationNode[] = [{ type: 'heading', title: 'Section' }]
    expect(collectDocRefs(nodes)).toEqual([])
  })

  it('collects refs depth-first through nested headings, in document order', () => {
    const nodes: PublicationNode[] = [
      { type: 'doc', ref: 'docs/index.md' },
      {
        type: 'heading',
        title: 'Getting Started',
        children: [
          { type: 'doc', ref: 'docs/getting-started.md' },
          { type: 'doc', ref: 'docs/guides/installation.md' },
        ],
      },
      {
        type: 'heading',
        title: 'Reference',
        children: [
          {
            type: 'heading',
            title: 'Nested',
            children: [{ type: 'doc', ref: 'docs/faq.md' }],
          },
        ],
      },
    ]

    expect(collectDocRefs(nodes)).toEqual([
      'docs/index.md',
      'docs/getting-started.md',
      'docs/guides/installation.md',
      'docs/faq.md',
    ])
  })

  it('collects a doc node\'s own ref plus refs nested in its children', () => {
    const nodes: PublicationNode[] = [
      {
        type: 'doc',
        ref: 'docs/guides/installation.md',
        children: [{ type: 'doc', ref: 'docs/guides/uninstall.md' }],
      },
    ]
    expect(collectDocRefs(nodes)).toEqual(['docs/guides/installation.md', 'docs/guides/uninstall.md'])
  })
})

describe('countNodes', () => {
  it('returns 0 for an empty tree', () => {
    expect(countNodes([])).toBe(0)
  })

  it('counts a flat list of nodes', () => {
    const nodes: PublicationNode[] = [
      { type: 'doc', ref: 'docs/a.md' },
      { type: 'heading', title: 'Section' },
    ]
    expect(countNodes(nodes)).toBe(2)
  })

  it('counts headings and their nested children', () => {
    const nodes: PublicationNode[] = [
      { type: 'doc', ref: 'docs/index.md' },
      {
        type: 'heading',
        title: 'Getting Started',
        children: [
          { type: 'doc', ref: 'docs/getting-started.md' },
          { type: 'doc', ref: 'docs/guides/installation.md' },
        ],
      },
    ]
    expect(countNodes(nodes)).toBe(4)
  })

  it('counts a doc node\'s nested children', () => {
    const nodes: PublicationNode[] = [
      {
        type: 'doc',
        ref: 'docs/guides/installation.md',
        children: [{ type: 'doc', ref: 'docs/guides/uninstall.md' }],
      },
    ]
    expect(countNodes(nodes)).toBe(2)
  })
})
