import { describe, expect, it } from 'vitest'
import type { IndexDocument } from '../indexer/types'
import type { Publication } from '../publications/types'
import type { SnippetSource } from '../resolver/types'
import { buildSampleWorkspaceFiles } from '../workspace/sample-workspace'
import type { ConditionsFile, VariablesFile, WorkspaceConfig } from '../workspace/types'
import { buildPublication, publicationOutputPath } from './publicationBuild'

function sampleContext() {
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
  const publication = JSON.parse(byPath.get('publications/user-guide.json')!) as Publication

  return { documents, snippets, variables, conditionsFile, workspaceConfig, publication }
}

describe('publicationOutputPath', () => {
  it('appends .html under publications/', () => {
    expect(publicationOutputPath('user-guide')).toBe('publications/user-guide.html')
  })
})

describe('buildPublication — sample workspace smoke test', () => {
  it('produces one file with cross-links rewritten to the regular per-doc pages and variables resolved', () => {
    const { documents, snippets, variables, conditionsFile, workspaceConfig, publication } = sampleContext()

    const result = buildPublication({
      publication,
      sourcePath: 'publications/user-guide.json',
      slug: 'user-guide',
      documents,
      snippets,
      variables,
      conditionsFile,
      profile: workspaceConfig.publishProfiles.public,
      siteTitle: workspaceConfig.site.title,
    })

    expect(result.files).toHaveLength(1)
    const [file] = result.files
    expect(file.path).toBe('publications/user-guide.html')
    expect(file.contents).toContain('AcmeCloud')
    expect(file.contents).toContain('href="../getting-started.html"')
    expect(file.contents).not.toContain('getting-started.md"')
  })
})

describe('buildPublication — gap-free hierarchy after condition filtering', () => {
  const documents: IndexDocument[] = [
    {
      path: 'docs/a.md',
      text: '---\ntitle: A\n---\n\n# A\n\nBefore.\n:::when audience=internal\n## Internal subsection\nSecret.\n:::\nAfter.\n',
    },
  ]
  const conditionsFile: ConditionsFile = { audience: ['customer', 'internal'] }
  const publication: Publication = {
    title: 'Guide',
    nodes: [{ type: 'heading', title: 'Top', children: [{ type: 'doc', ref: 'docs/a.md' }] }],
  }

  it('omits the hidden heading and its content under a profile that excludes it', () => {
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { audience: ['customer'] },
      siteTitle: 'Test',
    })
    expect(result.files[0].contents).not.toContain('Internal subsection')
    expect(result.files[0].contents).not.toContain('Secret.')
  })

  it('includes the heading at the correctly shifted level under a profile that allows it', () => {
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile,
      profile: { audience: ['internal'] },
      siteTitle: 'Test',
    })
    // doc is at tree depth 2 -> its H1 becomes <h2>, so its H2 becomes <h3>.
    expect(result.files[0].contents).toContain('<h3>Internal subsection</h3>')
  })
})

describe('buildPublication — reordering/nesting reflected in output levels', () => {
  const documents: IndexDocument[] = [{ path: 'docs/a.md', text: '---\ntitle: A\n---\n\n# A\n\nBody.\n' }]

  it('renders a top-level doc node as <h1>', () => {
    const publication: Publication = { title: 'Guide', nodes: [{ type: 'doc', ref: 'docs/a.md' }] }
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test',
    })
    expect(result.files[0].contents).toContain('<h1>A</h1>')
  })

  it('renders the same doc node nested one level under a heading as <h2>', () => {
    const publication: Publication = {
      title: 'Guide',
      nodes: [{ type: 'heading', title: 'Section', children: [{ type: 'doc', ref: 'docs/a.md' }] }],
    }
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test',
    })
    expect(result.files[0].contents).toContain('<h2>A</h2>')
  })

  it('renders a doc nested directly under another doc (no intervening heading) as <h2>', () => {
    const nestedDocuments: IndexDocument[] = [
      ...documents,
      { path: 'docs/b.md', text: '---\ntitle: B\n---\n\n# B\n\nBody.\n' },
    ]
    const publication: Publication = {
      title: 'Guide',
      nodes: [{ type: 'doc', ref: 'docs/a.md', children: [{ type: 'doc', ref: 'docs/b.md' }] }],
    }
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents: nestedDocuments,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test',
    })
    expect(result.files[0].contents).toContain('<h1>A</h1>')
    expect(result.files[0].contents).toContain('<h2>B</h2>')
  })
})

describe('buildPublication — a doc\'s own H1/H2/H3 re-nested at tree depth 3', () => {
  it('shifts H1/H2/H3 to H3/H4/H5 in order, with original text intact', () => {
    const documents: IndexDocument[] = [
      { path: 'docs/a.md', text: '---\ntitle: A\n---\n\n# A\n\nIntro.\n\n## Middle\n\nBody.\n\n### Deep\n\nMore.\n' },
    ]
    const publication: Publication = {
      title: 'Guide',
      nodes: [
        {
          type: 'heading',
          title: 'Outer',
          children: [{ type: 'heading', title: 'Inner', children: [{ type: 'doc', ref: 'docs/a.md' }] }],
        },
      ],
    }
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test',
    })
    const html = result.files[0].contents
    const h3 = html.indexOf('<h3>A</h3>')
    const h4 = html.indexOf('<h4>Middle</h4>')
    const h5 = html.indexOf('<h5>Deep</h5>')
    expect(h3).toBeGreaterThanOrEqual(0)
    expect(h4).toBeGreaterThan(h3)
    expect(h5).toBeGreaterThan(h4)
    expect(html).toContain('Intro.')
    expect(html).toContain('More.')
  })
})

describe('buildPublication — missing doc ref', () => {
  it('warns and skips the node without crashing, leaving other nodes unaffected', () => {
    const documents: IndexDocument[] = [{ path: 'docs/b.md', text: '---\ntitle: B\n---\n\n# B\n\nBody.\n' }]
    const publication: Publication = {
      title: 'Guide',
      nodes: [{ type: 'doc', ref: 'docs/missing.md' }, { type: 'doc', ref: 'docs/b.md' }],
    }
    const result = buildPublication({
      publication,
      sourcePath: 'publications/guide.json',
      slug: 'guide',
      documents,
      snippets: {},
      variables: {},
      conditionsFile: {},
      profile: {},
      siteTitle: 'Test',
    })
    expect(result.warnings).toEqual([
      { type: 'missing-publication-doc', file: 'publications/guide.json', message: expect.stringContaining('docs/missing.md') },
    ])
    expect(result.files[0].contents).toContain('<h1>B</h1>')
  })
})
