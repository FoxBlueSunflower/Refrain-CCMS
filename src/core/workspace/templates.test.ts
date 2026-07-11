import { describe, expect, it } from 'vitest'
import { defaultFrontmatterFor, isArchivedTemplatePath, seedTemplateContent, templateBaseDir } from './templates'

describe('defaultFrontmatterFor', () => {
  it('produces a titled H1 body for a document', () => {
    expect(defaultFrontmatterFor('document', 'March Release')).toBe('---\ntitle: March Release\n---\n\n# March Release\n')
  })

  it('produces a slugified name with null lineage fields for a snippet', () => {
    expect(defaultFrontmatterFor('snippet', 'Support Callout')).toBe(
      "---\nname: support-callout\ndescription: ''\nforked_from: null\nforked_from_snapshot: null\n---\n\n",
    )
  })

  it('falls back to "untitled" for a snippet whose title slugifies to empty', () => {
    expect(defaultFrontmatterFor('snippet', '   ')).toContain('name: untitled')
  })
})

describe('templateBaseDir', () => {
  it('returns templates/docs for documents', () => {
    expect(templateBaseDir('document')).toBe('templates/docs')
  })

  it('returns templates/snippets for snippets', () => {
    expect(templateBaseDir('snippet')).toBe('templates/snippets')
  })
})

describe('isArchivedTemplatePath', () => {
  it('is false for a root-level template file', () => {
    expect(isArchivedTemplatePath('release-notes.md')).toBe(false)
  })

  it('is true for a file directly inside archived/', () => {
    expect(isArchivedTemplatePath('archived/old-template.md')).toBe(true)
  })

  it('is true for a file nested under archived/', () => {
    expect(isArchivedTemplatePath('archived/sub/old-template.md')).toBe(true)
  })

  it('is false for a filename that merely starts with "archived" (no substring false-positive)', () => {
    expect(isArchivedTemplatePath('archived-thing.md')).toBe(false)
  })

  it('is false for a folder named archived that is not the first segment', () => {
    expect(isArchivedTemplatePath('notes/archived-thing.md')).toBe(false)
  })
})

describe('seedTemplateContent — document', () => {
  it('overwrites only the title, leaving the placeholder body untouched', () => {
    const template = '---\ntitle: Untitled release\norder: 3\n---\n\n# Fill in the highlights\n'
    const result = seedTemplateContent('document', template, 'March release')
    expect(result).toBe('---\ntitle: March release\norder: 3\n---\n\n# Fill in the highlights\n')
  })

  it('preserves an unrelated custom frontmatter key', () => {
    const template = '---\ntitle: Untitled\ncustom_key: keep-me\n---\n\nBody\n'
    const result = seedTemplateContent('document', template, 'New Title')
    expect(result).toContain('custom_key: keep-me')
  })
})

describe('seedTemplateContent — snippet', () => {
  it('slugifies the title into the name field', () => {
    const template = "---\nname: untitled\ndescription: ''\nforked_from: null\nforked_from_snapshot: null\n---\n\nPlaceholder\n"
    const result = seedTemplateContent('snippet', template, 'Support Callout')
    expect(result).toContain('name: support-callout')
  })

  it('falls back to "untitled" when the title slugifies to empty', () => {
    const template = "---\nname: untitled\n---\n\nPlaceholder\n"
    const result = seedTemplateContent('snippet', template, '   ')
    expect(result).toContain('name: untitled')
  })

  it('resets forked_from and forked_from_snapshot to null even when the template had non-null values', () => {
    const template = "---\nname: untitled\nforked_from: some-other-snippet\nforked_from_snapshot: 2026-01-01T00-00-00_publish\n---\n\nPlaceholder\n"
    const result = seedTemplateContent('snippet', template, 'New Snippet')
    expect(result).toContain('forked_from: null')
    expect(result).toContain('forked_from_snapshot: null')
  })

  it('preserves the description field verbatim', () => {
    const template = "---\nname: untitled\ndescription: 'A reusable callout'\n---\n\nPlaceholder\n"
    const result = seedTemplateContent('snippet', template, 'New Snippet')
    expect(result).toContain("description: 'A reusable callout'")
  })
})
