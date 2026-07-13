import { describe, expect, it } from 'vitest'
import { renderPage } from './html-template'
import type { NavNode } from './nav'

const nav: NavNode[] = [
  { kind: 'file', title: 'Home', href: 'index.html', active: false },
  { kind: 'file', title: 'Installation', href: 'guides/installation.html', active: true },
]

describe('renderPage', () => {
  it('includes a <title> combining the page and site title', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installing AcmeCloud', bodyHtml: '<p>x</p>', nav: [], homeHref: 'index.html' })
    expect(html).toContain('<title>Installing AcmeCloud · Acme Docs</title>')
  })

  it('embeds the body HTML verbatim', () => {
    const bodyHtml = '<h1>Installing AcmeCloud</h1><p>Download it.</p>'
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installing AcmeCloud', bodyHtml, nav: [], homeHref: 'index.html' })
    expect(html).toContain(bodyHtml)
  })

  it('includes a print stylesheet that hides the nav chrome', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Home', bodyHtml: '<p>x</p>', nav: [], homeHref: 'index.html' })
    expect(html).toContain('@media print')
    expect(html).toMatch(/@media print[^}]*\{[^]*?\.rf-nav[^]*?display:\s*none/)
  })

  it('renders the site title as a link to homeHref', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Home', bodyHtml: '<p>x</p>', nav: [], homeHref: '../index.html' })
    expect(html).toContain('<a class="rf-nav-title" href="../index.html">Acme Docs</a>')
  })

  it('gives the nav sidebar and content pane independent scroll regions', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Home', bodyHtml: '<p>x</p>', nav: [], homeHref: 'index.html' })
    expect(html).toMatch(/\.rf-shell\s*\{[^}]*height:\s*100vh/)
    expect(html).toMatch(/\.rf-nav\s*\{[^}]*overflow-y:\s*auto/)
    expect(html).toMatch(/\.rf-content\s*\{[^}]*overflow-y:\s*auto/)
  })

  it('renders exactly one active nav marker at the correct href', () => {
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Installation', bodyHtml: '<p>x</p>', nav, homeHref: 'index.html' })
    const activeMatches = html.match(/class="rf-nav-active"/g) ?? []
    expect(activeMatches).toHaveLength(1)
    expect(html).toContain('href="guides/installation.html" class="rf-nav-active"')
  })

  it('nests a file node\'s children under it, like a folder', () => {
    const nested: NavNode[] = [
      { kind: 'file', title: 'Guide', href: 'guide.html#a', active: false, children: [{ kind: 'file', title: 'Section', href: 'guide.html#b', active: false }] },
    ]
    const html = renderPage({ siteTitle: 'Acme Docs', pageTitle: 'Guide', bodyHtml: '<p>x</p>', nav: nested, homeHref: 'index.html' })
    expect(html).toContain('<a href="guide.html#a">Guide</a><ul class="rf-nav-list"><li><a href="guide.html#b">Section</a></li></ul>')
  })
})
