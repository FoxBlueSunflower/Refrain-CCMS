import type { NavNode } from './nav'

export interface PageTemplateInput {
  siteTitle: string
  pageTitle: string
  bodyHtml: string
  nav: NavNode[]
  /** Where the sidebar site-title link points, relative to this page (see homeHref computation in site.ts/publicationBuild.ts). */
  homeHref: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Exported so the Home landing page (src/core/builder/home-page.ts) can render the same nav tree as an in-page table of contents. */
export function renderNavNodes(nodes: NavNode[]): string {
  if (nodes.length === 0) return ''
  const items = nodes
    .map((node) => {
      const childHtml = node.children && node.children.length > 0 ? renderNavNodes(node.children) : ''
      if (node.kind === 'folder') {
        return `<li><span class="rf-nav-folder">${escapeHtml(node.title)}</span>${childHtml}</li>`
      }
      const activeAttrs = node.active ? ' class="rf-nav-active" aria-current="page"' : ''
      return `<li><a href="${escapeHtml(node.href)}"${activeAttrs}>${escapeHtml(node.title)}</a>${childHtml}</li>`
    })
    .join('')
  return `<ul class="rf-nav-list">${items}</ul>`
}

const MARKDOWN_BODY_CSS = `
.markdown-body { line-height: 1.6; }
.markdown-body > :first-child, .markdown-body > :first-child > :first-child { margin-top: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 { font-weight: 600; line-height: 1.25; margin: 1.5em 0 0.5em; }
.markdown-body h1 { font-size: 1.5rem; }
.markdown-body h2 { font-size: 1.25rem; }
.markdown-body h3 { font-size: 1.1rem; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body blockquote, .markdown-body pre { margin: 0.75em 0; }
.markdown-body ul, .markdown-body ol { padding-left: 1.5em; }
.markdown-body blockquote { border-left: 3px solid #d1d5db; padding-left: 0.75em; color: #4b5563; }
.markdown-body code { background: #f3f4f6; border-radius: 0.25em; padding: 0.1em 0.35em; font-size: 0.9em; }
.markdown-body pre code { display: block; padding: 0.75em; overflow-x: auto; background: #f3f4f6; border-radius: 0.375em; }
.markdown-body a { color: #7c3aed; }
.markdown-body li:has(> input[type='checkbox']) { list-style: none; margin-left: -1.5em; }
.markdown-body input[type='checkbox'] { appearance: none; -webkit-appearance: none; width: 0.9em; height: 0.9em; border: 1px solid #9ca3af; border-radius: 0.2em; margin-right: 0.5em; vertical-align: middle; position: relative; top: -1px; }
.markdown-body input[type='checkbox']:checked { background: #7c3aed; border-color: #7c3aed; }
.markdown-body input[type='checkbox']:checked::after { content: ''; position: absolute; left: 0.28em; top: 0.06em; width: 0.2em; height: 0.4em; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.markdown-body table { border-collapse: collapse; }
.markdown-body th, .markdown-body td { border: 1px solid #d1d5db; padding: 0.4em 0.6em; }
.rf-resolved-var { background-color: #ede9fe; border-radius: 0.2em; padding: 0 0.2em; }
.rf-resolve-error { background-color: #fee2e2; color: #991b1b; border-radius: 0.2em; padding: 0 0.35em; font-size: 0.9em; }
`

const PAGE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; background: #ffffff; }
.rf-shell { display: flex; height: 100vh; }
.rf-nav { width: 260px; flex-shrink: 0; height: 100%; padding: 1rem; border-right: 1px solid #e5e7eb; overflow-y: auto; }
.rf-nav-title { display: block; font-weight: 600; margin: 0 0 1rem; font-size: 1rem; color: inherit; text-decoration: none; }
.rf-nav-title:hover { text-decoration: underline; }
.rf-nav-list { list-style: none; margin: 0; padding-left: 0.75rem; }
.rf-nav-list .rf-nav-list { padding-left: 0.9rem; }
.rf-nav-folder { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin-top: 0.75rem; }
.rf-nav a { display: block; padding: 0.15rem 0; color: #374151; text-decoration: none; font-size: 0.9rem; }
.rf-nav a:hover { text-decoration: underline; }
.rf-nav a.rf-nav-active { color: #7c3aed; font-weight: 600; }
.rf-content { flex: 1; min-width: 0; height: 100%; padding: 2rem; max-width: 48rem; overflow-y: auto; }
${MARKDOWN_BODY_CSS}
@media print {
  .rf-nav { display: none; }
  .rf-shell { display: block; height: auto; }
  .rf-content { max-width: none; padding: 0; height: auto; overflow: visible; }
}
`

export function renderPage(input: PageTemplateInput): string {
  const { siteTitle, pageTitle, bodyHtml, nav, homeHref } = input
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)} · ${escapeHtml(siteTitle)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="rf-shell">
<aside class="rf-nav">
<a class="rf-nav-title" href="${escapeHtml(homeHref)}">${escapeHtml(siteTitle)}</a>
${renderNavNodes(nav)}
</aside>
<main class="rf-content">
<article class="markdown-body">${bodyHtml}</article>
</main>
</div>
</body>
</html>
`
}
