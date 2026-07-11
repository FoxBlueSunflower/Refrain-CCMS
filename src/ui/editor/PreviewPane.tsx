import { useMemo, type MouseEvent } from 'react'
import { marked } from 'marked'
import { annotateConditionBlocks } from '../../core/builder/conditions'
import { parseFrontmatter } from '../../core/frontmatter/parse'
import { resolveDocument } from '../../core/resolver/resolve'
import type { ResolveContext } from '../../core/resolver/types'
import { isExternalHref, resolveRelativeDocLink } from '../../core/workspace/paths'

interface PreviewPaneProps {
  text: string
  /** Relative to the workspace's docs/ folder; null when the open file is a
   *  snippet (snippets have no folder concept to resolve relative links against). */
  currentRelPath: string | null
  onNavigate: (relPath: string) => void
  resolveContext: ResolveContext
}

export function PreviewPane({ text, currentRelPath, onNavigate, resolveContext }: PreviewPaneProps) {
  const parsed = useMemo(() => parseFrontmatter(text), [text])
  const annotatedBody = useMemo(() => annotateConditionBlocks(parsed.body), [parsed.body])
  const resolved = useMemo(() => resolveDocument(annotatedBody, resolveContext), [annotatedBody, resolveContext])
  const html = useMemo(() => marked.parse(resolved.text, { async: false }), [resolved.text])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('#')) return

    if (isExternalHref(href)) {
      event.preventDefault()
      window.open(href, '_blank', 'noopener')
      return
    }

    // Never let a relative-looking href fall through to a real SPA
    // navigation — there's no router, so that either 404s to a blank page
    // or reloads the app back to its initial state.
    event.preventDefault()
    if (currentRelPath === null) return

    const resolvedLink = resolveRelativeDocLink(currentRelPath, href)
    if (resolvedLink) onNavigate(resolvedLink)
  }

  // Frontmatter parse warnings surface on FrontmatterFormPanel instead, since
  // it's now the primary frontmatter-facing UI — showing them here too would
  // just duplicate the same message.
  const warnings = resolved.warnings.map((w) => w.message)

  return (
    <div className="h-full overflow-auto bg-white p-4 text-gray-900" onClick={handleClick}>
      {warnings.length > 0 && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
