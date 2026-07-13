import { describe, expect, it } from 'vitest'
import type { PublicationNode } from '../publications/types'
import { buildWorkspaceIndex } from './build'
import { publicationsForDocuments } from './derive'
import type { IndexDocument, IndexPublication } from './types'

const BUILT_AT = '2026-07-09T00:00:00.000Z'

function doc(path: string, text: string): IndexDocument {
  return { path, text }
}

function publication(path: string, title: string, nodes: PublicationNode[]): IndexPublication {
  return { path, title, nodes }
}

describe('publicationsForDocuments', () => {
  it('returns an empty array when docPaths is empty', () => {
    const index = buildWorkspaceIndex({ documents: [], snippets: [] }, BUILT_AT)
    expect(publicationsForDocuments(index, [])).toEqual([])
  })

  it('returns an empty array when none of the docs appear in any publication', () => {
    const index = buildWorkspaceIndex({ documents: [doc('docs/a.md', 'Hi.')], snippets: [] }, BUILT_AT)
    expect(publicationsForDocuments(index, ['docs/a.md'])).toEqual([])
  })

  it('returns publications for a single doc, sorted by title', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.')],
        snippets: [],
        publications: [
          publication('z-guide.json', 'Z Guide', [{ type: 'doc', ref: 'docs/a.md' }]),
          publication('a-guide.json', 'A Guide', [{ type: 'doc', ref: 'docs/a.md' }]),
        ],
      },
      BUILT_AT,
    )
    expect(publicationsForDocuments(index, ['docs/a.md'])).toEqual([
      { path: 'a-guide.json', title: 'A Guide' },
      { path: 'z-guide.json', title: 'Z Guide' },
    ])
  })

  it('dedupes when two different docPaths both belong to the same publication', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.'), doc('docs/b.md', 'Bye.')],
        snippets: [],
        publications: [
          publication('user-guide.json', 'User Guide', [
            { type: 'doc', ref: 'docs/a.md' },
            { type: 'doc', ref: 'docs/b.md' },
          ]),
        ],
      },
      BUILT_AT,
    )
    expect(publicationsForDocuments(index, ['docs/a.md', 'docs/b.md'])).toEqual([
      { path: 'user-guide.json', title: 'User Guide' },
    ])
  })

  it('aggregates across multiple docPaths each in different publications', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.'), doc('docs/b.md', 'Bye.')],
        snippets: [],
        publications: [
          publication('guide-a.json', 'Guide A', [{ type: 'doc', ref: 'docs/a.md' }]),
          publication('guide-b.json', 'Guide B', [{ type: 'doc', ref: 'docs/b.md' }]),
        ],
      },
      BUILT_AT,
    )
    expect(publicationsForDocuments(index, ['docs/a.md', 'docs/b.md'])).toEqual([
      { path: 'guide-a.json', title: 'Guide A' },
      { path: 'guide-b.json', title: 'Guide B' },
    ])
  })
})
