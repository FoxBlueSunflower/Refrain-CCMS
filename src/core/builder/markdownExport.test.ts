import { describe, expect, it } from 'vitest'
import type { IndexDocument } from '../indexer/types'
import type { Publication } from '../publications/types'
import type { SnippetSource } from '../resolver/types'
import { buildSampleWorkspaceFiles } from '../workspace/sample-workspace'
import { buildDocTree } from '../workspace/tree'
import type { ConditionsFile, DocTreeNode, FolderMeta, RawEntry, VariablesFile, WorkspaceConfig } from '../workspace/types'
import { buildPublicationMarkdownExport, buildWorkspaceMarkdownExport } from './markdownExport'
import type { PublishInput } from './types'

function sampleInputFor(profileName: 'public' | 'internal'): PublishInput {
  const files = buildSampleWorkspaceFiles()
  const byPath = new Map(files.map((f) => [f.path, f.contents]))

  const documents: IndexDocument[] = files
    .filter((f) => f.path.startsWith('docs/') && f.path.endsWith('.md'))
    .map((f) => ({ path: f.path, text: f.contents }))

  const snippets: SnippetSource = Object.fromEntries(
    files
      .filter((f) => f.path.startsWith('snippets/') && f.path.endsWith('.md'))
      .map((f) => [f.path.slice('snippets/'.length, -'.md'.length), f.contents]),
  )

  const variables = JSON.parse(byPath.get('variables.json')!) as VariablesFile
  const conditionsFile = JSON.parse(byPath.get('conditions.json')!) as ConditionsFile
  const workspaceConfig = JSON.parse(byPath.get('workspace.json')!) as WorkspaceConfig

  const entries: RawEntry[] = []
  const folderMeta = new Map<string, FolderMeta>()
  for (const file of files) {
    if (!file.path.startsWith('docs/')) continue
    const relPath = file.path.slice('docs/'.length)
    if (relPath.endsWith('_folder.json')) {
      const segments = relPath.split('/')
      folderMeta.set(segments.slice(0, -1).join('/'), JSON.parse(file.contents) as FolderMeta)
      continue
    }
    entries.push({ path: relPath, kind: 'file' })
  }
  const docTree = buildDocTree(entries, folderMeta)

  return {
    documents,
    docTree,
    snippets,
    variables,
    conditionsFile,
    profile: workspaceConfig.publishProfiles[profileName],
    siteTitle: workspaceConfig.site.title,
  }
}

describe('buildWorkspaceMarkdownExport — sample workspace integration', () => {
  it('produces plain markdown with no HTML tags or resolver span markers', () => {
    const result = buildWorkspaceMarkdownExport(sampleInputFor('public'))
    expect(result.text).not.toContain('rf-resolved-var')
    expect(result.text).not.toContain('rf-resolve-error')
    expect(result.text).not.toMatch(/<span/)
  })

  it('omits internal-only content under the public profile', () => {
    const result = buildWorkspaceMarkdownExport(sampleInputFor('public'))
    expect(result.text).not.toContain('Internal note: staging licenses')
  })

  it('includes internal-only content under the internal profile', () => {
    const result = buildWorkspaceMarkdownExport(sampleInputFor('internal'))
    expect(result.text).toContain('Internal note: staging licenses')
  })

  it('resolves {{variables}} to their raw value', () => {
    const result = buildWorkspaceMarkdownExport(sampleInputFor('public'))
    expect(result.text).toContain('AcmeCloud')
  })

  it('separates concatenated documents with a markdown thematic break', () => {
    const result = buildWorkspaceMarkdownExport(sampleInputFor('public'))
    expect(result.text).toContain('\n\n---\n\n')
  })

  it('orders documents to match the doc tree (nav) order', () => {
    const documents: IndexDocument[] = [
      { path: 'docs/b.md', text: '# B\n\nBody B.\n' },
      { path: 'docs/a.md', text: '# A\n\nBody A.\n' },
    ]
    const docTree: DocTreeNode[] = [
      { kind: 'file', name: 'a', path: 'a.md' },
      { kind: 'file', name: 'b', path: 'b.md' },
    ]
    const result = buildWorkspaceMarkdownExport({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test Site',
    })
    expect(result.text.indexOf('Body A.')).toBeLessThan(result.text.indexOf('Body B.'))
  })

  it('surfaces a missing-variable warning in the same shape buildSite emits', () => {
    const documents: IndexDocument[] = [{ path: 'docs/index.md', text: '---\ntitle: Test\n---\n\nHi {{missing_var}}.\n' }]
    const docTree: DocTreeNode[] = [{ kind: 'file', name: 'index', path: 'index.md' }]
    const result = buildWorkspaceMarkdownExport({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test Site',
    })
    expect(result.warnings).toContainEqual({ type: 'missing-variable', file: 'docs/index.md', message: expect.any(String) })
  })
})

describe('buildPublicationMarkdownExport — heading levels', () => {
  const documents: IndexDocument[] = [
    { path: 'docs/a.md', text: '---\ntitle: A\n---\n\n# A\n\nIntro.\n\n## Middle\n\nBody.\n' },
    { path: 'docs/b.md', text: '---\ntitle: B\n---\n\n# B\n\nBody B.\n' },
  ]

  it('renders heading nodes and shifts doc headings to the tree-depth level', () => {
    const publication: Publication = {
      title: 'Guide',
      nodes: [{ type: 'heading', title: 'Section', children: [{ type: 'doc', ref: 'docs/a.md' }] }, { type: 'doc', ref: 'docs/b.md' }],
    }
    const result = buildPublicationMarkdownExport({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
    })
    expect(result.text).toContain('# Section')
    expect(result.text).toContain('## A')
    expect(result.text).toContain('### Middle')
    expect(result.text).toContain('# B')
    expect(result.warnings).toEqual([])
  })

  it('excludes condition-gated content not included in the active profile', () => {
    const gatedDocs: IndexDocument[] = [
      {
        path: 'docs/a.md',
        text: '---\ntitle: A\n---\n\n# A\n\nBefore.\n:::when audience=internal\nSecret.\n:::\nAfter.\n',
      },
    ]
    const publication: Publication = { title: 'Guide', nodes: [{ type: 'doc', ref: 'docs/a.md' }] }
    const conditionsFile: ConditionsFile = { audience: ['customer', 'internal'] }

    const result = buildPublicationMarkdownExport({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents: gatedDocs,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { audience: ['customer'] },
    })
    expect(result.text).not.toContain('Secret.')
    expect(result.text).toContain('Before.')
  })

  it('warns and skips a missing publication doc ref without crashing', () => {
    const publication: Publication = {
      title: 'Guide',
      nodes: [{ type: 'doc', ref: 'docs/missing.md' }, { type: 'doc', ref: 'docs/b.md' }],
    }
    const result = buildPublicationMarkdownExport({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
    })
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'missing-publication-doc', file: 'publications/guide.json' }),
    )
    expect(result.text).toContain('# B')
  })

  it('clamps heading levels deeper than H6 and warns', () => {
    let nodes: Publication['nodes'] = [{ type: 'doc', ref: 'docs/a.md' }]
    for (let i = 0; i < 7; i++) nodes = [{ type: 'heading', title: `Level ${i}`, children: nodes }]
    const publication: Publication = { title: 'Guide', nodes }

    const result = buildPublicationMarkdownExport({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
    })
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'heading-level-exceeds-h6' }))
    expect(result.text).not.toMatch(/#{7,}/)
  })

  it('produces plain markdown with no HTML tags', () => {
    const publication: Publication = { title: 'Guide', nodes: [{ type: 'doc', ref: 'docs/a.md' }] }
    const result = buildPublicationMarkdownExport({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
    })
    expect(result.text).not.toMatch(/<h\d|<section|<span/)
  })
})
