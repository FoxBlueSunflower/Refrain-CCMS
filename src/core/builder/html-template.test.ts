import { describe, expect, it } from 'vitest'
import { renderPage } from './html-template'
import type { NavNode } from './nav'

const nav: NavNode[] = [
  { kind: 'file', title: 'Home', href: 'index.html', active: false },
  { kind: 'file', title: 'Installation', href: 'guides/installation.html', active: true },
]

describe('renderPage', () => {
  it('includes a <title> combining the page and site title', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installing AcmeCloud', bodyHtml: '<p>x</p>', nav: [], searchEntries: [] })
    expect(html).toContain('<title>Installing AcmeCloud · Acme Docs</title>')
  })

  it('embeds the body HTML verbatim', () => {
    const bodyHtml = '<h1>Installing AcmeCloud</h1><p>Download it.</p>'
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installing AcmeCloud', bodyHtml, nav: [], searchEntries: [] })
    expect(html).toContain(bodyHtml)
  })

  it('includes a print stylesheet that hides nav and search chrome', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Home', bodyHtml: '<p>x</p>', nav: [], searchEntries: [] })
    expect(html).toContain('@media print')
    expect(html).toMatch(/@media print[^}]*\{[^]*?\.rf-nav[^]*?display:\s*none/)
  })

  it('inlines the search entries as page data, not a fetched file', () => {
    const html = renderPage({
      siteTitle: 'Acme Docs',
      pageTitle: 'Home',
      bodyHtml: '<p>x</p>',
      nav: [],
      searchEntries: [{ title: 'Installing AcmeCloud', href: 'guides/installation.html', text: 'Download it.' }],
    })
    expect(html).toContain('window.__RF_SEARCH__')
    expect(html).toContain('Installing AcmeCloud')
    expect(html).toContain('guides/installation.html')
    expect(html).not.toContain('fetch(')
  })

  it('renders exactly one active nav marker at the correct href', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installation', bodyHtml: '<p>x</p>', nav, searchEntries: [] })
    const activeMatches = html.match(/class="rf-nav-active"/g) ?? []
    expect(activeMatches).toHaveLength(1)
    expect(html).toContain('href="guides/installation.html" class="rf-nav-active"')
  })
})
