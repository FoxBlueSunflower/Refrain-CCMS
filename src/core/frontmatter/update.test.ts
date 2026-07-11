import { describe, expect, it } from 'vitest'
import { coerceScalar, parseFrontmatter } from './parse'
import { deleteFrontmatterField, setFrontmatterField } from './update'

describe('setFrontmatterField', () => {
  it('inserts a new key before the closing fence when absent', () => {
    const raw = `---\ntitle: Installing AcmeCloud\n---\n\n# Body\n`
    const result = setFrontmatterField(raw, 'order', 2)
    expect(result).toBe(`---\ntitle: Installing AcmeCloud\norder: 2\n---\n\n# Body\n`)
  })

  it('updates an existing key in place', () => {
    const raw = `---\ntitle: X\norder: 1\n---\nbody\n`
    const result = setFrontmatterField(raw, 'order', 5)
    expect(result).toBe(`---\ntitle: X\norder: 5\n---\nbody\n`)
  })

  it('preserves other keys and inline comments untouched', () => {
    const raw =
      '---\n' +
      'name: warning-banner\n' +
      'forked_from: null          # or "old-warning-banner"\n' +
      '---\n\n> Careful.\n'
    const result = setFrontmatterField(raw, 'order', 3)
    expect(result).toBe(
      '---\n' +
        'name: warning-banner\n' +
        'forked_from: null          # or "old-warning-banner"\n' +
        'order: 3\n' +
        '---\n\n> Careful.\n',
    )
  })

  it('preserves CRLF line endings', () => {
    const raw = '---\r\ntitle: Fine\r\n---\r\nbody\r\n'
    const result = setFrontmatterField(raw, 'order', 1)
    expect(result).toBe('---\r\ntitle: Fine\r\norder: 1\r\n---\r\nbody\r\n')
  })

  it('creates a frontmatter block when none exists, preserving the body', () => {
    const raw = '# Just a heading\n\nSome text.\n'
    const result = setFrontmatterField(raw, 'order', 1)
    expect(result).toBe('---\norder: 1\n---\n\n# Just a heading\n\nSome text.\n')
  })

  it('fails soft on a missing closing fence, preserving all original content', () => {
    const raw = '---\ntitle: Untitled\n\n# Heading\n\nBody text.\n'
    const result = setFrontmatterField(raw, 'order', 1)
    expect(result).toContain(raw)
  })

  it('quotes a string value that would otherwise be ambiguous', () => {
    const raw = '---\ntitle: X\n---\nbody\n'
    const result = setFrontmatterField(raw, 'name', '')
    expect(result).toContain("name: ''")
  })

  it('round-trips through parseFrontmatter after an update', () => {
    const raw = `---\ntitle: X\n---\nbody\n`
    const updated = setFrontmatterField(raw, 'order', 7)
    const parsed = parseFrontmatter(updated)
    expect(parsed.frontmatter).toEqual({ title: 'X', order: 7 })
    expect(parsed.body).toBe('body\n')
  })

  it('sets null correctly', () => {
    const raw = '---\ntitle: X\n---\nbody\n'
    const result = setFrontmatterField(raw, 'forked_from', null)
    expect(result).toContain('forked_from: null')
  })
})

describe('deleteFrontmatterField', () => {
  it('deletes an existing key, preserving other lines and inline comments', () => {
    const raw =
      '---\n' +
      'name: warning-banner\n' +
      'forked_from: null          # or "old-warning-banner"\n' +
      'order: 3\n' +
      '---\n\n> Careful.\n'
    const result = deleteFrontmatterField(raw, 'order')
    expect(result).toBe(
      '---\n' + 'name: warning-banner\n' + 'forked_from: null          # or "old-warning-banner"\n' + '---\n\n> Careful.\n',
    )
  })

  it('is a no-op when the key is absent', () => {
    const raw = '---\ntitle: X\n---\nbody\n'
    expect(deleteFrontmatterField(raw, 'order')).toBe(raw)
  })

  it('is a no-op when no frontmatter block exists', () => {
    const raw = '# Just a heading\n\nSome text.\n'
    expect(deleteFrontmatterField(raw, 'title')).toBe(raw)
  })

  it('is a no-op when the closing fence is missing', () => {
    const raw = '---\ntitle: Untitled\n\n# Heading\n\nBody text.\n'
    expect(deleteFrontmatterField(raw, 'title')).toBe(raw)
  })

  it('deleting the only remaining key leaves an empty frontmatter block', () => {
    const raw = '---\ntitle: X\n---\nbody\n'
    expect(deleteFrontmatterField(raw, 'title')).toBe('---\n---\nbody\n')
  })

  it('preserves CRLF line endings', () => {
    const raw = '---\r\ntitle: Fine\r\norder: 1\r\n---\r\nbody\r\n'
    expect(deleteFrontmatterField(raw, 'order')).toBe('---\r\ntitle: Fine\r\n---\r\nbody\r\n')
  })

  it('round-trips through parseFrontmatter after a delete', () => {
    const raw = '---\ntitle: X\norder: 7\n---\nbody\n'
    const result = deleteFrontmatterField(raw, 'order')
    const parsed = parseFrontmatter(result)
    expect(parsed.frontmatter).toEqual({ title: 'X' })
    expect(parsed.body).toBe('body\n')
  })

  it('deleting one key leaves an unrelated custom key completely untouched', () => {
    const raw = '---\ntitle: X\ncustom_field: keep-me\norder: 2\n---\nbody\n'
    const result = deleteFrontmatterField(raw, 'order')
    expect(parseFrontmatter(result).frontmatter).toEqual({ title: 'X', custom_field: 'keep-me' })
  })
})

describe('round-trip fidelity (Phase 8a acceptance criteria)', () => {
  it('a form-style sequence of setFrontmatterField calls matches one hand-written raw edit', () => {
    const raw = `---\ntitle: Old Title\n---\n\n# Body\n`
    const viaForm = setFrontmatterField(setFrontmatterField(raw, 'title', 'New Title'), 'order', 3)
    const viaHandEdit = `---\ntitle: New Title\norder: 3\n---\n\n# Body\n`
    expect(parseFrontmatter(viaForm)).toEqual(parseFrontmatter(viaHandEdit))
  })

  it('an unrecognized custom key survives a form edit to an unrelated known field', () => {
    const raw = `---\ntitle: X\ncustom_field: keep-me\n---\nbody\n`
    const result = setFrontmatterField(raw, 'order', 1)
    expect(parseFrontmatter(result).frontmatter.custom_field).toBe('keep-me')
  })

  it('an unrecognized custom key survives being deleted-and-recreated as part of a rename', () => {
    const raw = `---\ntitle: X\nold_custom: 42\nkeep_me: yes\n---\nbody\n`
    let next = deleteFrontmatterField(raw, 'old_custom')
    next = setFrontmatterField(next, 'new_custom', 42)
    expect(parseFrontmatter(next).frontmatter).toEqual({ title: 'X', keep_me: 'yes', new_custom: 42 })
  })

  it('coerceScalar-driven custom value entry matches hand-typing the same raw text', () => {
    const raw = `---\ntitle: X\n---\nbody\n`
    const typedNumber = setFrontmatterField(raw, 'count', coerceScalar('42'))
    const handEdited = `---\ntitle: X\ncount: 42\n---\nbody\n`
    expect(parseFrontmatter(typedNumber)).toEqual(parseFrontmatter(handEdited))
  })
})
