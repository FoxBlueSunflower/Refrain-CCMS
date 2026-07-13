import { describe, expect, it } from 'vitest'
import { collectInternalLinks } from './links'

describe('collectInternalLinks', () => {
  it('finds an internal link to an existing document', () => {
    const links = collectInternalLinks('See [the guide](other.md).', 'docs/index.md', new Set(['docs/other.md']))
    expect([...links]).toEqual(['docs/other.md'])
  })

  it('still includes an internal link whose target does not exist', () => {
    const links = collectInternalLinks('See [missing](missing.md).', 'docs/index.md', new Set(['docs/other.md']))
    expect([...links]).toEqual(['docs/missing.md'])
  })

  it('excludes external links', () => {
    const links = collectInternalLinks('See [external](https://example.com).', 'docs/index.md', new Set())
    expect(links.size).toBe(0)
  })

  it('excludes in-page anchors', () => {
    const links = collectInternalLinks('See [section](#section).', 'docs/index.md', new Set())
    expect(links.size).toBe(0)
  })

  it('returns an empty set when currentRelPath is null (snippet context)', () => {
    const links = collectInternalLinks('See [the guide](other.md).', null, new Set(['docs/other.md']))
    expect(links.size).toBe(0)
  })

  it('dedupes two links resolving to the same target', () => {
    const links = collectInternalLinks('[a](other.md) and [b](other.md)', 'docs/index.md', new Set(['docs/other.md']))
    expect([...links]).toEqual(['docs/other.md'])
  })

  it('resolves a relative "../" link from a nested document', () => {
    const links = collectInternalLinks('[up](../top.md)', 'docs/guides/nested.md', new Set(['docs/top.md']))
    expect([...links]).toEqual(['docs/top.md'])
  })

  it('resolves a link whose text contains nested brackets', () => {
    const links = collectInternalLinks('[a [b] c](other.md)', 'docs/index.md', new Set(['docs/other.md']))
    expect([...links]).toEqual(['docs/other.md'])
  })
})
