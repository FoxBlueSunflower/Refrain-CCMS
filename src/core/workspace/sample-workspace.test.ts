import { describe, expect, it } from 'vitest'
import { validatePublication } from '../publications/validate'
import { buildSampleWorkspaceFiles } from './sample-workspace'
import { validateConditionsFile, validateVariablesFile, validateWorkspaceConfig } from './validate'

function fileAt(path: string) {
  const file = buildSampleWorkspaceFiles().find((f) => f.path === path)
  if (!file) throw new Error(`sample workspace is missing ${path}`)
  return file.contents
}

describe('buildSampleWorkspaceFiles', () => {
  it('emits exactly the SPEC.md sample workspace file tree', () => {
    const paths = buildSampleWorkspaceFiles()
      .map((f) => f.path)
      .sort()
    expect(paths).toEqual(
      [
        'workspace.json',
        'variables.json',
        'conditions.json',
        'docs/index.md',
        'docs/getting-started.md',
        'docs/guides/_folder.json',
        'docs/guides/installation.md',
        'snippets/warning-banner.md',
        'snippets/support-contact.md',
        'templates/docs/release-notes.md',
        'templates/snippets/callout.md',
        'publications/user-guide.json',
      ].sort(),
    )
  })

  it('produces a workspace.json that passes validation', () => {
    const parsed: unknown = JSON.parse(fileAt('workspace.json'))
    const result = validateWorkspaceConfig(parsed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Acme Product Docs')
      expect(Object.keys(result.value.publishProfiles).sort()).toEqual(['internal', 'public'])
    }
  })

  it('produces a variables.json that passes validation and matches SPEC.md', () => {
    const parsed: unknown = JSON.parse(fileAt('variables.json'))
    const result = validateVariablesFile(parsed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.product_name.value).toBe('AcmeCloud')
      expect(result.value.support_email.value).toBe('help@acme.com')
      expect(result.value.version.value).toBe('3.2')
    }
  })

  it('produces a conditions.json that passes validation and matches SPEC.md', () => {
    const parsed: unknown = JSON.parse(fileAt('conditions.json'))
    const result = validateConditionsFile(parsed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.audience).toEqual(['customer', 'internal'])
      expect(result.value.output).toEqual(['web'])
    }
  })

  it('produces a parseable docs/guides/_folder.json', () => {
    const parsed = JSON.parse(fileAt('docs/guides/_folder.json'))
    expect(parsed).toEqual({ title: 'Guides', order: 3 })
  })

  it('installation.md exercises variables, a snippet include, and a condition block', () => {
    const md = fileAt('docs/guides/installation.md')
    expect(md).toContain('{{product_name}}')
    expect(md).toContain('{{version}}')
    expect(md).toContain('{{support_email}}')
    expect(md).toContain('{{> warning-banner}}')
    expect(md).toContain(':::when audience=internal')
    expect(md).toContain(':::')
  })

  it('index.md and getting-started.md reference the support-contact snippet', () => {
    expect(fileAt('docs/index.md')).toContain('{{> support-contact}}')
    expect(fileAt('docs/getting-started.md')).toContain('{{> support-contact}}')
  })

  for (const path of ['snippets/warning-banner.md', 'snippets/support-contact.md']) {
    it(`${path} frontmatter carries all four lineage fields`, () => {
      const md = fileAt(path)
      expect(md).toContain('name:')
      expect(md).toContain('description:')
      expect(md).toContain('forked_from:')
      expect(md).toContain('forked_from_snapshot:')
    })
  }

  it('seeds a document template with title/description placeholder frontmatter', () => {
    const md = fileAt('templates/docs/release-notes.md')
    expect(md).toContain('title:')
    expect(md).toContain('description:')
  })

  it('seeds a snippet template with all four lineage fields, unforked', () => {
    const md = fileAt('templates/snippets/callout.md')
    expect(md).toContain('name:')
    expect(md).toContain('forked_from: null')
    expect(md).toContain('forked_from_snapshot: null')
  })

  it('produces a publications/user-guide.json that passes validation and references real sample docs', () => {
    const parsed: unknown = JSON.parse(fileAt('publications/user-guide.json'))
    const result = validatePublication(parsed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.title).toBe('User Guide')
      const docPaths = ['docs/index.md', 'docs/getting-started.md', 'docs/guides/installation.md']
      const allPaths = buildSampleWorkspaceFiles().map((f) => f.path)
      for (const path of docPaths) expect(allPaths).toContain(path)
    }
  })

  it('is a pure function returning fresh data each call', () => {
    const a = buildSampleWorkspaceFiles()
    const b = buildSampleWorkspaceFiles()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})
