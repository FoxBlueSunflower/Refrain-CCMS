import { describe, expect, it } from 'vitest'
import {
  isExternalHref,
  isValidFilename,
  joinPath,
  resolveRelativeDocLink,
  slugify,
  splitPath,
  uniqueSlug,
  withMdExtension,
} from './paths'

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

describe('isExternalHref', () => {
  it('recognizes http(s) URLs', () => {
    expect(isExternalHref('https://example.com')).toBe(true)
    expect(isExternalHref('http://example.com')).toBe(true)
  })

  it('recognizes mailto links', () => {
    expect(isExternalHref('mailto:help@acme.com')).toBe(true)
  })

  it('recognizes protocol-relative links', () => {
    expect(isExternalHref('//example.com/page')).toBe(true)
  })

  it('does not flag a plain relative markdown link', () => {
    expect(isExternalHref('guides/installation.md')).toBe(false)
  })
})

describe('resolveRelativeDocLink', () => {
  it('resolves a same-directory link', () => {
    expect(resolveRelativeDocLink('index.md', 'getting-started.md')).toBe('getting-started.md')
  })

  it('resolves a link into a subfolder', () => {
    expect(resolveRelativeDocLink('index.md', 'guides/installation.md')).toBe('guides/installation.md')
  })

  it('resolves ../ from a nested document', () => {
    expect(resolveRelativeDocLink('guides/installation.md', '../index.md')).toBe('index.md')
  })

  it('resolves a leading ./', () => {
    expect(resolveRelativeDocLink('index.md', './getting-started.md')).toBe('getting-started.md')
  })

  it('rejects an absolute path', () => {
    expect(resolveRelativeDocLink('index.md', '/docs/index.md')).toBeNull()
  })

  it('rejects an external URL', () => {
    expect(resolveRelativeDocLink('index.md', 'https://example.com')).toBeNull()
  })

  it('rejects a mailto link', () => {
    expect(resolveRelativeDocLink('index.md', 'mailto:help@acme.com')).toBeNull()
  })

  it('rejects a link that would escape above docs/', () => {
    expect(resolveRelativeDocLink('index.md', '../../etc/passwd.md')).toBeNull()
  })

  it('rejects a non-.md target', () => {
    expect(resolveRelativeDocLink('index.md', 'diagram.png')).toBeNull()
  })

  it('rejects an in-page anchor', () => {
    expect(resolveRelativeDocLink('index.md', '#section')).toBeNull()
  })

  it('strips a trailing in-page anchor from an otherwise valid link', () => {
    expect(resolveRelativeDocLink('index.md', 'guides/installation.md#warning')).toBe('guides/installation.md')
  })
})
