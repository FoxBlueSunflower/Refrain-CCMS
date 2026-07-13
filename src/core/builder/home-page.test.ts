import { describe, expect, it } from 'vitest'
import { buildHomePage } from './home-page'
import type { NavNode } from './nav'

describe('buildHomePage', () => {
  it('renders at index.html with the site title and prefixed nav hrefs pointing into content/', () => {
    const nav: NavNode[] = [
      { kind: 'file', title: 'Getting Started', href: 'getting-started.html', active: false },
      {
        kind: 'folder',
        title: 'Guides',
        children: [{ kind: 'file', title: 'Installation', href: 'guides/installation.html', active: false }],
      },
    ]

    const home = buildHomePage({ siteTitle: 'Acme Docs', nav, searchIndex: [] })

    expect(home.path).toBe('index.html')
    expect(home.contents).toContain('<h1>Acme Docs</h1>')
    expect(home.contents).toContain('href="content/getting-started.html"')
    expect(home.contents).toContain('href="content/guides/installation.html"')
  })

  it('prefixes search entries into content/ too, using a custom contentDir', () => {
    const home = buildHomePage({
      siteTitle: 'Acme Docs',
      nav: [],
      searchIndex: [{ title: 'Installation', path: 'guides/installation.html', text: 'Download it.' }],
      contentDir: 'site',
    })

    expect(home.contents).toContain('site/guides/installation.html')
  })
})
