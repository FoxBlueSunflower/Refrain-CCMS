import { describe, expect, it } from 'vitest'
import type { IndexDocument } from '../indexer/types'
import type { SnippetSource } from '../resolver/types'
import { buildSampleWorkspaceFiles } from '../workspace/sample-workspace'
import { buildDocTree } from '../workspace/tree'
import type { ConditionsFile, DocTreeNode, FolderMeta, RawEntry, VariablesFile, WorkspaceConfig } from '../workspace/types'
import { buildSite } from './site'
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

describe('buildSite — sample workspace integration', () => {
  it('omits internal-only content under the public profile', () => {
    const result = buildSite(sampleInputFor('public'))
    const installation = result.files.find((f) => f.path === 'guides/installation.html')
    expect(installation).toBeDefined()
    expect(installation!.contents).not.toContain('Internal note: staging licenses')
  })

  it('includes internal-only content under the internal profile', () => {
    const result = buildSite(sampleInputFor('internal'))
    const installation = result.files.find((f) => f.path === 'guides/installation.html')
    expect(installation).toBeDefined()
    expect(installation!.contents).toContain('Internal note: staging licenses')
  })

  it('rewrites in-workspace .md links to .html in the rendered output', () => {
    const result = buildSite(sampleInputFor('public'))
    const index = result.files.find((f) => f.path === 'index.html')
    expect(index).toBeDefined()
    expect(index!.contents).toContain('href="getting-started.html"')
    expect(index!.contents).not.toContain('getting-started.md"')
  })

  it('resolves {{variables}} in the rendered body', () => {
    const result = buildSite(sampleInputFor('public'))
    const index = result.files.find((f) => f.path === 'index.html')
    expect(index!.contents).toContain('AcmeCloud')
  })
})

describe('buildSite — condition warnings', () => {
  it('warns on an unknown condition value and excludes the block, naming the file and line', () => {
    const documents: IndexDocument[] = [
      { path: 'docs/index.md', text: '---\ntitle: Test\n---\n\nBefore.\n:::when audience=bogus\nSecret.\n:::\nAfter.\n' },
    ]
    const docTree: DocTreeNode[] = [{ kind: 'file', name: 'index', path: 'index.md' }]
    const conditionsFile: ConditionsFile = { audience: ['customer'], output: ['web'] }

    const result = buildSite({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { audience: ['customer'], output: ['web'] },
      siteTitle: 'Test Site',
    })

    expect(result.warnings).toEqual([
      { type: 'unknown-condition-value', file: 'docs/index.md', line: 6, message: expect.any(String) },
    ])
    const index = result.files.find((f) => f.path === 'index.html')
    expect(index!.contents).not.toContain('Secret.')
  })
})

describe('buildSite — user-defined dimensions', () => {
  it('filters correctly through the full pipeline using a dimension other than audience/output', () => {
    const documents: IndexDocument[] = [
      { path: 'docs/index.md', text: '---\ntitle: Test\n---\n\nBefore.\n:::when region=us\nUS-only note.\n:::\nAfter.\n' },
    ]
    const docTree: DocTreeNode[] = [{ kind: 'file', name: 'index', path: 'index.md' }]
    const conditionsFile: ConditionsFile = { region: ['us', 'eu'] }

    const usResult = buildSite({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { region: ['us'] },
      siteTitle: 'Test Site',
    })
    expect(usResult.warnings).toEqual([])
    expect(usResult.files.find((f) => f.path === 'index.html')!.contents).toContain('US-only note.')

    const euResult = buildSite({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { region: ['eu'] },
      siteTitle: 'Test Site',
    })
    expect(euResult.warnings).toEqual([])
    expect(euResult.files.find((f) => f.path === 'index.html')!.contents).not.toContain('US-only note.')
  })
})

describe('buildSite — home page', () => {
  it('always produces a homeFile at index.html, separate from content files, even when no doc maps to that path', () => {
    const documents: IndexDocument[] = [{ path: 'docs/guides/setup.md', text: '# Setup\n' }]
    const docTree: DocTreeNode[] = [
      { kind: 'folder', name: 'Guides', path: 'guides', children: [{ kind: 'file', name: 'setup', path: 'guides/setup.md' }] },
    ]

    const result = buildSite({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile: { audience: [], output: [] },
      profile: { audience: [], output: [] },
      siteTitle: 'Test Site',
    })

    expect(result.files.map((f) => f.path).sort()).toEqual(['guides/setup.html'])
    expect(result.homeFile.path).toBe('index.html')
    expect(result.homeFile.contents).toContain('Test Site')
    expect(result.homeFile.contents).toContain('href="content/guides/setup.html"')
  })

  it("doesn't collide with a real docs/index.md, which stays a normal content page", () => {
    const documents: IndexDocument[] = [{ path: 'docs/index.md', text: '---\ntitle: Welcome\n---\n\nBody.\n' }]
    const docTree: DocTreeNode[] = [{ kind: 'file', name: 'index', path: 'index.md' }]

    const result = buildSite({
      documents,
      docTree,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test Site',
    })

    expect(result.files.map((f) => f.path)).toEqual(['index.html'])
    expect(result.files[0].contents).toContain('Body.')
    expect(result.homeFile.path).toBe('index.html')
    expect(result.homeFile.contents).toContain('href="content/index.html"')
  })
})
