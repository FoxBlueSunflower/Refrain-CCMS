import { Marked, Renderer, type Tokens } from 'marked'
import { classifyLink, resolveRelativeDocLink } from '../workspace/paths'

function createLinkCollectingRenderer(hrefs: string[]): Renderer {
  const renderer = new Renderer()
  // A regular function, not an arrow: marked assigns `this` to whatever live
  // renderer instance it's parsing with, and Renderer.prototype.link reads
  // `this.parser` — see the identical precedent in
  // src/core/builder/site.ts's createLinkRewritingRenderer.
  renderer.link = function (this: Renderer, token: Tokens.Link) {
    hrefs.push(token.href)
    return Renderer.prototype.link.call(this, token)
  }
  return renderer
}

/**
 * Every internal (workspace-resolvable) document link referenced anywhere in
 * `text`, as resolved doc-relative paths. Uses marked's parser rather than a
 * hand-rolled regex — same reasoning as pillPlugin.ts's buildLinkDecorations —
 * since link destinations/text can legally contain nested brackets/parens.
 * `internal-ok` and `internal-broken` targets both count as "referenced";
 * external links, anchors, and (when currentRelPath is null, i.e. a snippet)
 * unresolvable links are excluded.
 */
export function collectInternalLinks(text: string, currentRelPath: string | null, documentPaths: ReadonlySet<string>): Set<string> {
  const resolved = new Set<string>()
  if (currentRelPath === null) return resolved

  const hrefs: string[] = []
  new Marked({ renderer: createLinkCollectingRenderer(hrefs) }).parse(text)

  for (const href of hrefs) {
    const classification = classifyLink(href, currentRelPath, documentPaths)
    if (classification !== 'internal-ok' && classification !== 'internal-broken') continue
    const target = resolveRelativeDocLink(currentRelPath, href)
    if (target !== null) resolved.add(target)
  }
  return resolved
}
