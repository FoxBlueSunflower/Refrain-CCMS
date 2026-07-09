import { describe, expect, it } from 'vitest'
import { isValidFilename, joinPath, slugify, splitPath, uniqueSlug, withMdExtension } from './paths'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Installing AcmeCloud')).toBe('installing-acmecloud')
  })

  it('strips punctuation', () => {
    expect(slugify("What's New?!")).toBe('what-s-new')
  })

  it('collapses repeated separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello')
  })

  it('handles unicode by stripping non a-z0-9 characters', () => {
    expect(slugify('café résumé')).toBe('caf-r-sum')
  })
})

describe('joinPath / splitPath', () => {
  it('joins segments with a single slash', () => {
    expect(joinPath('docs', 'guides', 'installation.md')).toBe('docs/guides/installation.md')
  })

  it('filters empty segments', () => {
    expect(joinPath('docs', '', 'guides')).toBe('docs/guides')
  })

  it('flattens segments that already contain slashes', () => {
    expect(joinPath('docs/guides', 'installation.md')).toBe('docs/guides/installation.md')
  })

  it('splits a path into non-empty parts', () => {
    expect(splitPath('docs/guides/installation.md')).toEqual(['docs', 'guides', 'installation.md'])
  })

  it('splits ignoring leading/trailing/duplicate slashes', () => {
    expect(splitPath('/docs//guides/')).toEqual(['docs', 'guides'])
  })
})

describe('isValidFilename', () => {
  it('accepts an ordinary filename', () => {
    expect(isValidFilename('installation.md')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidFilename('')).toBe(false)
  })

  it('rejects "." and ".."', () => {
    expect(isValidFilename('.')).toBe(false)
    expect(isValidFilename('..')).toBe(false)
  })

  it('rejects names containing a forward slash', () => {
    expect(isValidFilename('../etc/passwd')).toBe(false)
    expect(isValidFilename('docs/evil.md')).toBe(false)
  })

  it('rejects names containing a backslash', () => {
    expect(isValidFilename('evil\\file.md')).toBe(false)
  })
})

describe('withMdExtension', () => {
  it('appends .md when missing', () => {
    expect(withMdExtension('installation')).toBe('installation.md')
  })

  it('leaves an existing .md extension alone', () => {
    expect(withMdExtension('installation.md')).toBe('installation.md')
  })
})

describe('uniqueSlug', () => {
  it('returns the base unchanged when there is no collision', () => {
    expect(uniqueSlug('new-doc', new Set())).toBe('new-doc')
  })

  it('appends -2 on the first collision', () => {
    expect(uniqueSlug('new-doc', new Set(['new-doc']))).toBe('new-doc-2')
  })

  it('keeps incrementing until a free slug is found', () => {
    expect(uniqueSlug('new-doc', new Set(['new-doc', 'new-doc-2', 'new-doc-3']))).toBe('new-doc-4')
  })
})
