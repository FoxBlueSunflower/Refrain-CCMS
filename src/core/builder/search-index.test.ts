import { describe, expect, it } from 'vitest'
import { buildSearchIndex } from './search-index'

describe('buildSearchIndex', () => {
  it('strips HTML tags and collapses whitespace into plain text', () => {
    const [entry] = buildSearchIndex([
      { outputPath: 'index.html', title: 'Home', bodyHtml: '<h1>Welcome</h1>\n<p>To   AcmeCloud.</p>' },
    ])
    expect(entry.text).toBe('Welcome To AcmeCloud.')
  })

  it('produces one entry per page with title and path carried through', () => {
    const entries = buildSearchIndex([
      { outputPath: 'index.html', title: 'Home', bodyHtml: '<p>Hi.</p>' },
      { outputPath: 'guides/installation.html', title: 'Installing AcmeCloud', bodyHtml: '<p>Steps.</p>' },
    ])
    expect(entries).toEqual([
      { title: 'Home', path: 'index.html', text: 'Hi.' },
      { title: 'Installing AcmeCloud', path: 'guides/installation.html', text: 'Steps.' },
    ])
  })

  it('returns an empty array for no pages', () => {
    expect(buildSearchIndex([])).toEqual([])
  })
})
