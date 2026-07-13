import { describe, expect, it } from 'vitest'
import type { PublicationNode } from '../publications/types'
import { buildSampleWorkspaceFiles } from '../workspace/sample-workspace'
import { buildWorkspaceIndex } from './build'
import type { IndexDocument, IndexPublication, IndexSnippet } from './types'

const BUILT_AT = '2026-07-09T00:00:00.000Z'

function doc(path: string, text: string): IndexDocument {
  return { path, text }
}

function snippet(name: string, text: string): IndexSnippet {
  return { name, text }
}

function publication(path: string, title: string, nodes: PublicationNode[]): IndexPublication {
  return { path, title, nodes }
}

describe('buildWorkspaceIndex', () => {
  it('indexes a direct variable reference', () => {
    const index = buildWorkspaceIndex({ documents: [doc('docs/a.md', 'Hi {{product_name}}.')], snippets: [] }, BUILT_AT)
    expect(index.builtAt).toBe(BUILT_AT)
    expect(index.variables).toEqual({ product_name: ['docs/a.md'] })
  })

  it('indexes a direct snippet transclusion', () => {
    const index = buildWorkspaceIndex(
      { documents: [doc('docs/a.md', '{{> warning-banner}}')], snippets: [snippet('warning-banner', 'Careful.')] },
      BUILT_AT,
    )
    expect(index.snippets).toEqual({ 'warning-banner': ['docs/a.md'] })
  })

  it('picks up a variable used only inside a transcluded snippet (one level)', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', '{{> support-contact}}')],
        snippets: [snippet('support-contact', 'Email {{support_email}}.')],
      },
      BUILT_AT,
    )
    expect(index.variables).toEqual({ support_email: ['docs/a.md'] })
    expect(index.snippets).toEqual({ 'support-contact': ['docs/a.md'] })
  })

  it('picks up a variable two snippet levels deep, matching the resolver depth cap', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', '{{> outer}}')],
        snippets: [snippet('outer', '{{> inner}}'), snippet('inner', 'Version {{version}}.')],
      },
      BUILT_AT,
    )
    expect(index.variables).toEqual({ version: ['docs/a.md'] })
    expect(index.snippets).toEqual({ outer: ['docs/a.md'], inner: ['docs/a.md'] })
  })

  it('does not expand a third snippet level, matching MAX_SNIPPET_DEPTH in resolve.ts', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', '{{> a}}')],
        snippets: [snippet('a', '{{> b}}'), snippet('b', '{{> c}}'), snippet('c', 'Too deep {{deep_var}}.')],
      },
      BUILT_AT,
    )
    expect(index.snippets).toEqual({ a: ['docs/a.md'], b: ['docs/a.md'] })
    expect(index.snippets.c).toBeUndefined()
    expect(index.variables.deep_var).toBeUndefined()
  })

  it('tracks a snippet used directly by another snippet, even when neither is pulled into any document', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [],
        snippets: [snippet('outer', '{{> inner}}'), snippet('inner', 'Careful.')],
      },
      BUILT_AT,
    )
    expect(index.snippetsUsedBySnippets).toEqual({ inner: ['outer'] })
    expect(index.snippets.inner).toBeUndefined()
  })

  it('attributes a snippet used by two other snippets to both', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [],
        snippets: [snippet('a', '{{> shared}}'), snippet('b', '{{> shared}}'), snippet('shared', 'Hi.')],
      },
      BUILT_AT,
    )
    expect(index.snippetsUsedBySnippets).toEqual({ shared: ['a', 'b'] })
  })

  it('leaves a snippet with no snippet-includes absent from snippetsUsedBySnippets', () => {
    const index = buildWorkspaceIndex({ documents: [], snippets: [snippet('lonely', 'No includes here.')] }, BUILT_AT)
    expect(index.snippetsUsedBySnippets).toEqual({})
  })

  it('ignores a reference to a missing snippet without crashing or fabricating an entry', () => {
    const index = buildWorkspaceIndex({ documents: [doc('docs/a.md', '{{> ghost}}')], snippets: [] }, BUILT_AT)
    expect(index.snippets).toEqual({ ghost: ['docs/a.md'] })
    expect(Object.keys(index.variables)).toEqual([])
  })

  it('terminates on a circular snippet include instead of looping forever', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', '{{> a}}')],
        snippets: [snippet('a', '{{> b}}'), snippet('b', '{{> a}}')],
      },
      BUILT_AT,
    )
    expect(index.snippets).toEqual({ a: ['docs/a.md'], b: ['docs/a.md'] })
  })

  it('indexes a condition block', () => {
    const index = buildWorkspaceIndex(
      { documents: [doc('docs/a.md', ':::when audience=internal\nSecret.\n:::')], snippets: [] },
      BUILT_AT,
    )
    expect(index.conditions).toEqual({ 'audience=internal': ['docs/a.md'] })
  })

  it('matches the sample workspace: counts reflect direct and snippet-transitive usage', () => {
    const files = buildSampleWorkspaceFiles()
    const documents = files
      .filter((f) => f.path.startsWith('docs/') && f.path.endsWith('.md'))
      .map((f) => doc(f.path, f.contents))
    const snippets = files
      .filter((f) => f.path.startsWith('snippets/') && f.path.endsWith('.md'))
      .map((f) => snippet(f.path.slice('snippets/'.length, -'.md'.length), f.contents))

    const index = buildWorkspaceIndex({ documents, snippets }, BUILT_AT)

    expect(index.variables.product_name).toEqual(
      ['docs/getting-started.md', 'docs/guides/installation.md', 'docs/index.md'].sort(),
    )
    expect(index.variables.support_email).toEqual(
      ['docs/getting-started.md', 'docs/guides/installation.md', 'docs/index.md'].sort(),
    )
    expect(index.variables.version).toEqual(['docs/getting-started.md', 'docs/guides/installation.md'].sort())
    expect(index.snippets['warning-banner']).toEqual(['docs/guides/installation.md'])
    expect(index.snippets['support-contact']).toEqual(['docs/getting-started.md', 'docs/index.md'].sort())
    expect(index.conditions['audience=internal']).toEqual(['docs/guides/installation.md'])
  })

  it('leaves documentPublications empty when no publications are given', () => {
    const index = buildWorkspaceIndex({ documents: [doc('docs/a.md', 'Hi.')], snippets: [] }, BUILT_AT)
    expect(index.documentPublications).toEqual({})
  })

  it('indexes a doc referenced by one publication', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.')],
        snippets: [],
        publications: [publication('user-guide.json', 'User Guide', [{ type: 'doc', ref: 'docs/a.md' }])],
      },
      BUILT_AT,
    )
    expect(index.documentPublications).toEqual({ 'docs/a.md': [{ path: 'user-guide.json', title: 'User Guide' }] })
  })

  it('indexes a doc referenced by two publications, sorted by title', () => {
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
    expect(index.documentPublications['docs/a.md']).toEqual([
      { path: 'a-guide.json', title: 'A Guide' },
      { path: 'z-guide.json', title: 'Z Guide' },
    ])
  })

  it('indexes a doc referenced via a nested heading node', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.')],
        snippets: [],
        publications: [
          publication('user-guide.json', 'User Guide', [
            { type: 'heading', title: 'Section', children: [{ type: 'doc', ref: 'docs/a.md' }] },
          ]),
        ],
      },
      BUILT_AT,
    )
    expect(index.documentPublications['docs/a.md']).toEqual([{ path: 'user-guide.json', title: 'User Guide' }])
  })

  it('leaves a doc absent from documentPublications when no publication references it', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [doc('docs/a.md', 'Hi.'), doc('docs/b.md', 'Bye.')],
        snippets: [],
        publications: [publication('user-guide.json', 'User Guide', [{ type: 'doc', ref: 'docs/a.md' }])],
      },
      BUILT_AT,
    )
    expect(index.documentPublications['docs/b.md']).toBeUndefined()
  })

  it('still surfaces an orphaned publication ref to a doc that no longer exists (fail-soft, same as other index entries)', () => {
    const index = buildWorkspaceIndex(
      {
        documents: [],
        snippets: [],
        publications: [publication('user-guide.json', 'User Guide', [{ type: 'doc', ref: 'docs/gone.md' }])],
      },
      BUILT_AT,
    )
    expect(index.documentPublications['docs/gone.md']).toEqual([{ path: 'user-guide.json', title: 'User Guide' }])
  })
})
