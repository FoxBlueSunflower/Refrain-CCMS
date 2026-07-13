import { Marked } from 'marked'
import { parseFrontmatter } from '../frontmatter/parse'
import { flattenPublication } from '../publications/flatten'
import type { Publication, PublicationNode } from '../publications/types'
import { resolveDocument } from '../resolver/resolve'
import type { SnippetSource } from '../resolver/types'
import { findNestingViolations } from '../validator/nesting'
import { DOCS_DIR, PUBLICATIONS_DIR } from '../workspace/constants'
import { relativePath } from '../workspace/paths'
import type { ConditionsFile, PublishProfile, VariablesFile } from '../workspace/types'
import type { IndexDocument } from '../indexer/types'
import { filterConditions } from './conditions'
import { buildHomePage } from './home-page'
import { createLinkRewritingRenderer } from './site'
import { escapeHtml, renderPage } from './html-template'
import type { NavNode } from './nav'
import { shiftHeadingLevels } from './headingShift'
import { nestingViolationsToBuildWarnings } from './nestingWarnings'
import { substituteTitleVariables } from './titleSubstitution'
import type { BuildWarning, BuiltFile, PublishResult } from './types'

export interface PublicationBuildInput {
  publication: Publication
  /** e.g. "publications/user-guide.json" — the `file` field on structural (non-per-doc) warnings. */
  sourcePath: string
  /** e.g. "user-guide" — the publication's filename with ".json" stripped. */
  slug: string
  documents: IndexDocument[]
  snippets: SnippetSource
  variables: VariablesFile
  conditionsFile: ConditionsFile
  profile: PublishProfile
  /**
   * Defaults to the publication's own (variable-substituted) title when
   * omitted, for a standalone single-publication export. Callers embedding
   * this page inside a larger export (e.g. the whole-workspace export)
   * override it with that export's own site name.
   */
  siteTitle?: string
}

/** "user-guide" -> "publications/user-guide.html", relative to the publish/ root. */
export function publicationOutputPath(slug: string): string {
  return `${PUBLICATIONS_DIR}/${slug}.html`
}

function anchorId(index: number): string {
  return `pub-node-${index}`
}

/**
 * Mirrors flattenPublication's own depth-first pre-order traversal (visit
 * node, recurse into children, then move to the next sibling) so the ids it
 * assigns line up 1:1 with the anchor ids buildPublication stamps onto the
 * rendered fragments below, without the two walks sharing any state — both
 * just visit the same immutable `publication.nodes` in the same order.
 * Hrefs are bare `#pub-node-N` fragments, correct for use directly on the
 * publication's own content page; see qualifyAnchorHrefs for the home page.
 */
function buildPublicationNav(
  nodes: PublicationNode[],
  titleByRef: Map<string, string>,
  byPath: Map<string, IndexDocument>,
  counter: { n: number },
): NavNode[] {
  const out: NavNode[] = []
  for (const node of nodes) {
    const id = counter.n++
    const children = node.children ? buildPublicationNav(node.children, titleByRef, byPath, counter) : []

    if (node.type === 'heading') {
      out.push({ kind: 'file', title: node.title, href: `#${anchorId(id)}`, active: false, ...(children.length > 0 ? { children } : {}) })
      continue
    }

    // Missing-doc nodes are already warned about in the fragment pass below; skip them here
    // rather than link to an anchor that was never rendered onto the page.
    if (!byPath.has(node.ref)) continue
    const title = titleByRef.get(node.ref) ?? node.ref
    out.push({ kind: 'file', title, href: `#${anchorId(id)}`, active: false, ...(children.length > 0 ? { children } : {}) })
  }
  return out
}

/** Rewrites buildPublicationNav's bare `#anchor` hrefs into `outputPath#anchor`, for reuse on the publication's own home page (which then goes through the usual content/ prefixing). */
function qualifyAnchorHrefs(nodes: NavNode[], outputPath: string): NavNode[] {
  return nodes.map((node): NavNode => {
    if (node.kind === 'folder') return { kind: 'folder', title: node.title, children: qualifyAnchorHrefs(node.children, outputPath) }
    return {
      kind: 'file',
      title: node.title,
      href: `${outputPath}${node.href}`,
      active: false,
      ...(node.children && node.children.length > 0 ? { children: qualifyAnchorHrefs(node.children, outputPath) } : {}),
    }
  })
}

function fallbackTitleFor(docRelPath: string): string {
  const withoutExt = docRelPath.endsWith('.md') ? docRelPath.slice(0, -3) : docRelPath
  return withoutExt.split('/').pop() ?? withoutExt
}

/**
 * Builds a publication (Phase 9c) — an ordered tree of doc references and
 * structural headings — into ONE continuous HTML page: each doc node's own
 * H1 becomes whatever heading level its tree depth implies, and its
 * internal H2-H6 shift down by the same offset to stay nested beneath it.
 * Condition-tag filtering runs before the heading shift (same per-doc order
 * buildSite already uses), so content hidden by a `:::when:::` block can
 * never desync the level count. Additive to buildSite's per-document,
 * one-page-per-doc output — cross-links inside a publication still point at
 * those regular per-doc pages, which keep existing unchanged.
 *
 * Every node (doc or heading) gets a `pub-node-{index}` anchor: heading
 * nodes on their own `<h#>` tag, doc nodes on a `<section>` wrapper around
 * their rendered content (marked doesn't emit heading ids in this
 * codebase's config, so the wrapper is the only reliable anchor point). The
 * sidebar hierarchy (on both this page and its own home page) links to
 * those same anchors.
 */
export function buildPublication(input: PublicationBuildInput): PublishResult {
  const { publication, sourcePath, slug, documents, snippets, variables, conditionsFile, profile } = input
  const warnings: BuildWarning[] = []
  const outputPath = publicationOutputPath(slug)
  const pageTitle = substituteTitleVariables(publication.title, variables)
  const siteTitle = input.siteTitle ?? pageTitle

  const byPath = new Map(documents.map((doc) => [doc.path, doc]))
  const flat = flattenPublication(publication.nodes)
  const titleByRef = new Map<string, string>()

  const fragments: string[] = []

  flat.forEach((node, index) => {
    const id = anchorId(index)

    if (node.levelClamped) {
      const label = node.type === 'doc' ? node.ref : node.title
      warnings.push({
        type: 'heading-level-exceeds-h6',
        file: sourcePath,
        message: `"${label}" sits deeper than 6 levels in the publication tree and was capped at H6.`,
      })
    }

    if (node.type === 'heading') {
      const title = escapeHtml(substituteTitleVariables(node.title, variables))
      fragments.push(`<h${node.level} id="${id}">${title}</h${node.level}>`)
      return
    }

    const document = byPath.get(node.ref)
    if (!document) {
      warnings.push({
        type: 'missing-publication-doc',
        file: sourcePath,
        message: `Publication references "${node.ref}", which was not found in docs/.`,
      })
      return
    }

    const docRelPath = document.path.startsWith(`${DOCS_DIR}/`) ? document.path.slice(DOCS_DIR.length + 1) : document.path

    const conditionResult = filterConditions(document.text, document.path, profile, conditionsFile)
    warnings.push(...conditionResult.warnings)

    // Runs on the raw, pre-filter body — see the matching comment in site.ts.
    const rawBody = parseFrontmatter(document.text).body
    warnings.push(...nestingViolationsToBuildWarnings(findNestingViolations(rawBody, { variables, snippets }), document.path))

    const { frontmatter, body, warnings: fmWarnings } = parseFrontmatter(conditionResult.text)
    for (const message of fmWarnings) warnings.push({ type: 'frontmatter', file: document.path, message })

    const rawTitle = typeof frontmatter.title === 'string' ? frontmatter.title : undefined
    titleByRef.set(node.ref, rawTitle ? substituteTitleVariables(rawTitle, variables) : fallbackTitleFor(docRelPath))

    const resolved = resolveDocument(body, { variables, snippets })
    for (const w of resolved.warnings) warnings.push({ type: w.type, file: document.path, message: w.message })

    // shiftHeadingLevels runs on already-resolved text (frontmatter stripped,
    // {{key}}/{{> snippet}} expanded), so its line numbers don't correspond to
    // the writer's actual file — drop `line` rather than report a misleading one.
    const shifted = shiftHeadingLevels(resolved.text, node.level, document.path)
    for (const w of shifted.warnings) warnings.push({ type: w.type, file: w.file, message: w.message })

    const engine = new Marked({ renderer: createLinkRewritingRenderer(docRelPath, outputPath) })
    const docHtml = engine.parse(shifted.text, { async: false }) as string
    fragments.push(`<section id="${id}" class="rf-pub-section">${docHtml}</section>`)
  })

  const bodyHtml = fragments.join('\n')
  const homeHref = relativePath(`content/${outputPath}`, 'index.html')
  const nav = buildPublicationNav(publication.nodes, titleByRef, byPath, { n: 0 })
  const contents = renderPage({ siteTitle, pageTitle, bodyHtml, nav, homeHref })

  const file: BuiltFile = { path: outputPath, contents }
  const homeFile = buildHomePage({ siteTitle, nav: qualifyAnchorHrefs(nav, outputPath) })
  return { files: [file], homeFile, homeNav: [], warnings }
}
