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

    const home = buildHomePage({ siteTitle: 'Acme Docs', nav })

    expect(home.path).toBe('index.html')
    expect(home.contents).toContain('<h1>Acme Docs</h1>')
    expect(home.contents).toContain('href="content/getting-started.html"')
    expect(home.contents).toContain('href="content/guides/installation.html"')
  })

  it('uses a custom contentDir to prefix nav hrefs', () => {
    const home = buildHomePage({
      siteTitle: 'Acme Docs',
      nav: [{ kind: 'file', title: 'Installation', href: 'guides/installation.html', active: false }],
      contentDir: 'site',
    })

    expect(home.contents).toContain('site/guides/installation.html')
  })

  it('renders a Publications section above the doc nav when publications are given', () => {
    const home = buildHomePage({
      siteTitle: 'Acme Docs',
      nav: [{ kind: 'file', title: 'Getting Started', href: 'getting-started.html', active: false }],
      publications: [{ title: 'User Guide', href: 'publications/user-guide.html' }],
    })

    expect(home.contents).toContain('<h2>Publications</h2>')
    expect(home.contents).toContain('href="content/publications/user-guide.html"')
    expect(home.contents).toContain('<h2>Documents</h2>')
    const publicationsIndex = home.contents.indexOf('Publications</h2>')
    const documentsIndex = home.contents.indexOf('Documents</h2>')
    expect(publicationsIndex).toBeLessThan(documentsIndex)
  })

  it('omits the Publications section entirely when none are given', () => {
    const home = buildHomePage({ siteTitle: 'Acme Docs', nav: [] })
    expect(home.contents).not.toContain('<h2>Publications</h2>')
  })
})
