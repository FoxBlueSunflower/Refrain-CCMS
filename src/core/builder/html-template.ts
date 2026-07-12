import type { NavNode } from './nav'
import type { SearchEntry } from './search-index'

export interface PageTemplateInput {
  siteTitle: string
  pageTitle: string
  bodyHtml: string
  nav: NavNode[]
  /** Search entries with `path` already rewritten to an href relative to this page. */
  searchEntries: Array<Pick<SearchEntry, 'title' | 'text'> & { href: string }>
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderNavNodes(nodes: NavNode[]): string {
  if (nodes.length === 0) return ''
  const items = nodes
    .map((node) => {
      if (node.kind === 'folder') {
        return `<li><span class="rf-nav-folder">${escapeHtml(node.title)}</span>${renderNavNodes(node.children)}</li>`
      }
      const activeAttrs = node.active ? ' class="rf-nav-active" aria-current="page"' : ''
      return `<li><a href="${escapeHtml(node.href)}"${activeAttrs}>${escapeHtml(node.title)}</a></li>`
    })
    .join('')
  return `<ul class="rf-nav-list">${items}</ul>`
}

/**
 * Search data must be inlined, never fetched: Chromium blocks fetch() of a
 * sibling file under file://, and the published site needs to work by
 * opening it locally with no server. `</` is escaped so a search entry's
 * text can never prematurely close the surrounding <script> tag.
 */
function inlineSearchData(entries: PageTemplateInput['searchEntries']): string {
  return JSON.stringify(entries).replace(/</g, '\\u003c')
}

const MARKDOWN_BODY_CSS = `
.markdown-body { line-height: 1.6; }
.markdown-body > :first-child { margin-top: 0; }
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
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #1f2937; background: #ffffff; }
.rf-shell { display: flex; min-height: 100vh; }
.rf-nav { width: 260px; flex-shrink: 0; padding: 1rem; border-right: 1px solid #e5e7eb; overflow-y: auto; }
.rf-nav-title { font-weight: 600; margin: 0 0 1rem; font-size: 1rem; }
.rf-nav-list { list-style: none; margin: 0; padding-left: 0.75rem; }
.rf-nav-list .rf-nav-list { padding-left: 0.9rem; }
.rf-nav-folder { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin-top: 0.75rem; }
.rf-nav a { display: block; padding: 0.15rem 0; color: #374151; text-decoration: none; font-size: 0.9rem; }
.rf-nav a:hover { text-decoration: underline; }
.rf-nav a.rf-nav-active { color: #7c3aed; font-weight: 600; }
.rf-content { flex: 1; min-width: 0; padding: 2rem; max-width: 48rem; }
.rf-search { margin-bottom: 1.5rem; position: relative; }
.rf-search input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; }
.rf-search-results { position: absolute; left: 0; right: 0; top: 100%; margin-top: 0.25rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.375rem; max-height: 20rem; overflow-y: auto; z-index: 10; display: none; }
.rf-search-results.rf-search-open { display: block; }
.rf-search-results a { display: block; padding: 0.5rem 0.75rem; color: #1f2937; text-decoration: none; border-bottom: 1px solid #f3f4f6; }
.rf-search-results a:hover { background: #f9fafb; }
.rf-search-empty { padding: 0.5rem 0.75rem; color: #6b7280; font-size: 0.9rem; }
${MARKDOWN_BODY_CSS}
@media print {
  .rf-nav, .rf-search { display: none; }
  .rf-shell { display: block; }
  .rf-content { max-width: none; padding: 0; }
}
`

const SEARCH_SCRIPT = `
(function () {
  var input = document.getElementById('rf-search-input');
  var results = document.getElementById('rf-search-results');
  var data = window.__RF_SEARCH__ || [];
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function render(query) {
    clear(results);
    if (!query) { results.classList.remove('rf-search-open'); return; }
    var q = query.toLowerCase();
    var titleMatches = [];
    var textMatches = [];
    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      if (entry.title.toLowerCase().indexOf(q) !== -1) titleMatches.push(entry);
      else if (entry.text.toLowerCase().indexOf(q) !== -1) textMatches.push(entry);
    }
    var matches = titleMatches.concat(textMatches).slice(0, 20);
    if (matches.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'rf-search-empty';
      empty.textContent = 'No results.';
      results.appendChild(empty);
    } else {
      for (var j = 0; j < matches.length; j++) {
        var a = document.createElement('a');
        a.href = matches[j].href;
        a.textContent = matches[j].title;
        results.appendChild(a);
      }
    }
    results.classList.add('rf-search-open');
  }
  if (input && results) {
    input.addEventListener('input', function () { render(input.value.trim()); });
    input.addEventListener('focus', function () { render(input.value.trim()); });
    input.addEventListener('blur', function () { setTimeout(function () { results.classList.remove('rf-search-open'); }, 150); });
  }
})();
`

export function renderPage(input: PageTemplateInput): string {
  const { siteTitle, pageTitle, bodyHtml, nav, searchEntries } = input
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
<p class="rf-nav-title">${escapeHtml(siteTitle)}</p>
${renderNavNodes(nav)}
</aside>
<main class="rf-content">
<div class="rf-search">
<input id="rf-search-input" type="search" placeholder="Search…" autocomplete="off">
<div id="rf-search-results" class="rf-search-results"></div>
</div>
<article class="markdown-body">${bodyHtml}</article>
</main>
</div>
<script>window.__RF_SEARCH__ = ${inlineSearchData(searchEntries)};</script>
<script>${SEARCH_SCRIPT}</script>
</body>
</html>
`
}
