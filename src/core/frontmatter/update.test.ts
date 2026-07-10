import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from './parse'
import { setFrontmatterField } from './update'

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
