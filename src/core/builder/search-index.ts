export interface SearchEntry {
  title: string
  /** Output path relative to the publish/ root, e.g. "guides/installation.html". */
  path: string
  text: string
}

/** Strips markup and collapses whitespace — no DOM/DOMParser, this module stays framework-free. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Builds one canonical search index from each page's already condition-filtered
 * body HTML, so a profile's search results never surface content that profile
 * excluded from the page itself.
 */
export function buildSearchIndex(pages: Array<{ outputPath: string; title: string; bodyHtml: string }>): SearchEntry[] {
  return pages.map((page) => ({ title: page.title, path: page.outputPath, text: stripHtml(page.bodyHtml) }))
}
