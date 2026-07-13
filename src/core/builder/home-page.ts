import { escapeHtml, renderNavNodes, renderPage } from './html-template'
import { prefixNavHrefs } from './nav'
import type { NavNode } from './nav'
import type { SearchEntry } from './search-index'
import type { BuiltFile } from './types'

export interface HomePageInput {
  siteTitle: string
  /** hrefs root-relative to the content/ folder (see buildNav with a virtual current path) */
  nav: NavNode[]
  /** unprefixed, straight from buildSearchIndex */
  searchIndex: SearchEntry[]
  contentDir?: string
}

/**
 * The landing page that ships at the root of every exported zip, outside
 * the content/ folder holding the rest of the site. Reuses the same page
 * shell (sidebar nav + search) as regular content pages so it reads as part
 * of the same site, just with its nav/search hrefs rewritten to point one
 * level down into content/.
 */
export function buildHomePage(input: HomePageInput): BuiltFile {
  const { siteTitle, nav, searchIndex, contentDir = 'content' } = input
  const homeNav = prefixNavHrefs(nav, contentDir)
  const homeSearchEntries = searchIndex.map((entry) => ({
    title: entry.title,
    text: entry.text,
    href: `${contentDir}/${entry.path}`,
  }))

  const bodyHtml = `<h1>${escapeHtml(siteTitle)}</h1><p>Welcome. Pick a page below or search to get started.</p><nav class="rf-home-toc">${renderNavNodes(homeNav)}</nav>`

  return {
    path: 'index.html',
    contents: renderPage({ siteTitle, pageTitle: siteTitle, bodyHtml, nav: homeNav, searchEntries: homeSearchEntries }),
  }
}
