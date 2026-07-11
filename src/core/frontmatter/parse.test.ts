import { describe, expect, it } from 'vitest'
import { coerceScalar, parseFrontmatter } from './parse'

describe('parseFrontmatter', () => {
  it('parses well-formed document frontmatter', () => {
    const raw = `---\ntitle: Installing AcmeCloud\ndescription: Get up and running in ten minutes.\norder: 2\n---\n\n# Installing AcmeCloud\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({
      title: 'Installing AcmeCloud',
      description: 'Get up and running in ten minutes.',
      order: 2,
    })
    expect(typeof result.frontmatter.order).toBe('number')
    expect(result.body).toBe('\n# Installing AcmeCloud\n')
    expect(result.warnings).toEqual([])
  })

  it('parses snippet frontmatter with trailing # comments on null values', () => {
    const raw =
      '---\n' +
      'name: warning-banner\n' +
      'description: Standard caution box for destructive actions\n' +
      'forked_from: null          # or "old-warning-banner"\n' +
      'forked_from_snapshot: null # history timestamp it was copied at\n' +
      '---\n\n> Careful.\n'
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({
      name: 'warning-banner',
      description: 'Standard caution box for destructive actions',
      forked_from: null,
      forked_from_snapshot: null,
    })
    expect(result.warnings).toEqual([])
  })

  it('parses an empty quoted string as an empty string, not literal quotes', () => {
    const raw = `---\ndescription: ''\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.description).toBe('')
  })

  it('preserves a # inside a quoted value instead of treating it as a comment', () => {
    const raw = `---\ndescription: "Caution: #1 rule"\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.description).toBe('Caution: #1 rule')
  })

  it('treats a file with no frontmatter block as pure body', () => {
    const raw = `# Just a heading\n\nSome text.\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe(raw)
    expect(result.warnings).toEqual([])
  })

  it('reports a missing closing fence but preserves the remainder as body', () => {
    const raw = `---\ntitle: Untitled\n\n# Heading\n\nBody text.\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('title: Untitled\n\n# Heading\n\nBody text.\n')
    expect(result.warnings).toHaveLength(1)
  })

  it('skips a colon-less garbage line with a warning but keeps parsing valid siblings', () => {
    const raw = `---\ntitle: Fine\nthis line has no colon\ndescription: Also fine\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({ title: 'Fine', description: 'Also fine' })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('this line has no colon')
  })

  it('silently skips a full-line # comment inside the frontmatter block', () => {
    const raw = `---\n# just a comment\ntitle: Fine\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({ title: 'Fine' })
    expect(result.warnings).toEqual([])
  })

  it('handles CRLF line endings identically to LF', () => {
    const raw = '---\r\ntitle: Fine\r\n---\r\nbody\r\n'
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({ title: 'Fine' })
    expect(result.body).toBe('body\r\n')
  })

  it('preserves a colon that appears inside a value', () => {
    const raw = `---\ntitle: Installing {{product_name}}: the basics\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Installing {{product_name}}: the basics')
  })

  it('does not treat a later in-body "---" as re-opening or closing frontmatter', () => {
    const raw = `---\ntitle: Fine\n---\n\nSome text\n\n---\n\nMore text after a horizontal rule.\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter).toEqual({ title: 'Fine' })
    expect(result.body).toBe('\nSome text\n\n---\n\nMore text after a horizontal rule.\n')
  })

  it('coerces an integer-looking value to a number, not a string', () => {
    const raw = `---\norder: 2\n---\nbody\n`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.order).toBe(2)
    expect(typeof result.frontmatter.order).toBe('number')
  })
})

describe('coerceScalar', () => {
  it('coerces a plain string', () => {
    expect(coerceScalar('warning-banner')).toBe('warning-banner')
  })

  it('coerces an integer string to a number', () => {
    expect(coerceScalar('42')).toBe(42)
  })

  it('coerces a decimal string to a number', () => {
    expect(coerceScalar('3.2')).toBe(3.2)
  })

  it('coerces a negative number string to a number', () => {
    expect(coerceScalar('-7')).toBe(-7)
  })

  it('coerces "true" and "false" to booleans', () => {
    expect(coerceScalar('true')).toBe(true)
    expect(coerceScalar('false')).toBe(false)
  })

  it('coerces "null" to null', () => {
    expect(coerceScalar('null')).toBeNull()
  })

  it('preserves a quoted string containing a #', () => {
    expect(coerceScalar('"Caution: #1 rule"')).toBe('Caution: #1 rule')
  })

  it('coerces an empty quoted string to an empty string', () => {
    expect(coerceScalar("''")).toBe('')
  })

  it('trims a whitespace-padded value', () => {
    expect(coerceScalar('  spaced out  ')).toBe('spaced out')
  })
})
