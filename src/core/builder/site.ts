import { Marked, Renderer, type Tokens } from 'marked'
import { parseFrontmatter } from '../frontmatter/parse'
import { resolveDocument } from '../resolver/resolve'
import { findNestingViolations } from '../validator/nesting'
import { DOCS_DIR } from '../workspace/constants'
import { relativePath, resolveRelativeDocLink } from '../workspace/paths'
import type { DocTreeNode } from '../workspace/types'
import { filterConditions } from './conditions'
import { buildHomePage } from './home-page'
import { buildNav, docPathToOutputPath } from './nav'
import { renderPage } from './html-template'
import { nestingViolationsToBuildWarnings } from './nestingWarnings'
import { substituteTitleVariables } from './titleSubstitution'
import type { BuildWarning, BuiltFile, PublishInput, PublishResult } from './types'

function collectFileNodes(nodes: DocTreeNode[], out: Map<string, DocTreeNode>): void {
  for (const node of nodes) {
    if (node.kind === 'file') out.set(node.path, node)
    else if (node.children) collectFileNodes(node.children, out)
  }
}

/**
 * A fresh renderer per document (never the shared global `marked` instance,
 * which src/ui/editor/PreviewPane.tsx also uses) that rewrites in-workspace
 * `.md` links to the corresponding page-relative `.html` href, reusing the
 * same link-resolution logic the live preview already uses.
 */
export function createLinkRewritingRenderer(docRelPath: string, outputPath: string): Renderer {
  const renderer = new Renderer()
  // A regular function, not an arrow: marked assigns `this` to whatever live
  // renderer instance it's parsing with, and Renderer.prototype.link reads
  // `this.parser` — an arrow function (or a pre-bound closure over `renderer`)
  // would freeze `this` before marked's internal wiring sets that up.
  renderer.link = function (this: Renderer, token: Tokens.Link) {
    const target = resolveRelativeDocLink(docRelPath, token.href)
    const rewritten = target ? { ...token, href: relativePath(outputPath, docPathToOutputPath(target)) } : token
    return Renderer.prototype.link.call(this, rewritten)
  }
  return renderer
}

interface PageDraft {
  docRelPath: string
  outputPath: string
  title: string
  bodyHtml: string
}

/**
 * Resolves and filters a workspace per publish profile into a static HTML
 * site. Pure and synchronous — no fs, no DOM; callers supply already-loaded
 * documents/snippets/variables/conditions and receive back generated files
 * to write themselves (see src/fs).
 */
export function buildSite(input: PublishInput): PublishResult {
  const { documents, docTree, snippets, variables, conditionsFile, profile, siteTitle } = input
  const warnings: BuildWarning[] = []

  const treeNodesByPath = new Map<string, DocTreeNode>()
  collectFileNodes(docTree, treeNodesByPath)

  const pages: PageDraft[] = []
  for (const document of documents) {
    const docRelPath = document.path.startsWith(`${DOCS_DIR}/`) ? document.path.slice(DOCS_DIR.length + 1) : document.path
    const filePath = `${DOCS_DIR}/${docRelPath}`
    const outputPath = docPathToOutputPath(docRelPath)

    const conditionResult = filterConditions(document.text, filePath, profile, conditionsFile)
    warnings.push(...conditionResult.warnings)

    // Runs on the raw, pre-filter body (not conditionResult.text) so a
    // condition nested inside another condition/blockquote/list-item/table
    // cell is still detectable — filterConditions has already mangled that
    // pattern beyond recognition by the time its own output is available.
    const rawBody = parseFrontmatter(document.text).body
    warnings.push(...nestingViolationsToBuildWarnings(findNestingViolations(rawBody, { variables, snippets }), filePath))

    const { frontmatter, body, warnings: fmWarnings } = parseFrontmatter(conditionResult.text)
    for (const message of fmWarnings) warnings.push({ type: 'frontmatter', file: filePath, message })

    const rawTitle = typeof frontmatter.title === 'string' ? frontmatter.title : undefined
    const fallbackTitle = treeNodesByPath.get(docRelPath)?.name ?? docRelPath
    const title = rawTitle ? substituteTitleVariables(rawTitle, variables) : fallbackTitle

    const resolved = resolveDocument(body, { variables, snippets })
    for (const w of resolved.warnings) warnings.push({ type: w.type, file: filePath, message: w.message })

    const engine = new Marked({ renderer: createLinkRewritingRenderer(docRelPath, outputPath) })
    const bodyHtml = engine.parse(resolved.text, { async: false }) as string

    pages.push({ docRelPath, outputPath, title, bodyHtml })
  }

  const titleByRelPath = new Map(pages.map((p) => [p.docRelPath, p.title]))
  const titleFor = (docRelPath: string) => titleByRelPath.get(docRelPath) ?? ''

  const renderPageAt = (outputPath: string, pageTitle: string, bodyHtml: string): BuiltFile => {
    const nav = buildNav(docTree, outputPath, titleFor)
    const homeHref = relativePath(`content/${outputPath}`, 'index.html')
    return { path: outputPath, contents: renderPage({ siteTitle, pageTitle, bodyHtml, nav, homeHref }) }
  }

  const files: BuiltFile[] = pages.map((page) => renderPageAt(page.outputPath, page.title, page.bodyHtml))

  const homeNav = buildNav(docTree, '__home__.html', titleFor)
  const homeFile = buildHomePage({ siteTitle, nav: homeNav })

  return { files, homeFile, homeNav, warnings }
}
