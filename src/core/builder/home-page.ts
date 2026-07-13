import { escapeHtml, renderNavNodes, renderPage } from './html-template'
import { prefixNavHrefs } from './nav'
import type { NavNode } from './nav'
import type { BuiltFile } from './types'

export interface HomePageInput {
  siteTitle: string
  /** hrefs root-relative to the content/ folder (see buildNav with a virtual current path) */
  nav: NavNode[]
  /** Optional flat list of Publications, rendered as their own section above the doc nav (whole-workspace export only). Hrefs are unprefixed, same convention as `nav`. */
  publications?: Array<{ title: string; href: string }>
  contentDir?: string
}

/**
 * The landing page that ships at the root of every exported zip, outside
 * the content/ folder holding the rest of the site. Reuses the same page
 * shell (sidebar nav) as regular content pages so it reads as part of the
 * same site, just with its nav hrefs rewritten to point one level down into
 * content/.
 */
export function buildHomePage(input: HomePageInput): BuiltFile {
  const { siteTitle, nav, publications = [], contentDir = 'content' } = input
  const homeNav = prefixNavHrefs(nav, contentDir)

  const publicationsHtml =
    publications.length > 0
      ? `<h2>Publications</h2><nav class="rf-home-toc">${renderNavNodes(
          publications.map((pub): NavNode => ({ kind: 'file', title: pub.title, href: `${contentDir}/${pub.href}`, active: false })),
        )}</nav>`
      : ''
  const documentsHeading = publications.length > 0 && nav.length > 0 ? '<h2>Documents</h2>' : ''

  const bodyHtml = `<h1>${escapeHtml(siteTitle)}</h1><p>Welcome. Pick a page below to get started.</p>${publicationsHtml}${documentsHeading}<nav class="rf-home-toc">${renderNavNodes(homeNav)}</nav>`

  return {
    path: 'index.html',
    contents: renderPage({ siteTitle, pageTitle: siteTitle, bodyHtml, nav: homeNav, homeHref: 'index.html' }),
  }
}
