import { parseFrontmatter } from '../frontmatter/parse'
import { flattenPublication } from '../publications/flatten'
import { resolveDocument } from '../resolver/resolve'
import { findNestingViolations } from '../validator/nesting'
import { DOCS_DIR } from '../workspace/constants'
import type { DocTreeNode } from '../workspace/types'
import type { IndexDocument } from '../indexer/types'
import { filterConditions } from './conditions'
import { shiftHeadingLevels } from './headingShift'
import { nestingViolationsToBuildWarnings } from './nestingWarnings'
import { substituteTitleVariables } from './titleSubstitution'
import type { PublicationBuildInput } from './publicationBuild'
import type { BuildWarning, PublishInput } from './types'

export interface MarkdownExportResult {
  text: string
  warnings: BuildWarning[]
}

const DOC_SEPARATOR = '\n\n---\n\n'

function collectDocsInTreeOrder(nodes: DocTreeNode[], byPath: Map<string, IndexDocument>, out: IndexDocument[]): void {
  for (const node of nodes) {
    if (node.kind === 'file') {
      const doc = byPath.get(node.path)
      if (doc) out.push(doc)
    } else if (node.children) {
      collectDocsInTreeOrder(node.children, byPath, out)
    }
  }
}

/**
 * Resolves and filters a workspace per publish profile into one concatenated
 * plain-markdown string — the "Export as Markdown" counterpart to
 * buildSite's HTML pages, meant for pasting into Google Docs or handing to
 * an AI tool to produce a PDF elsewhere. Documents only (Publications get
 * their own buildPublicationMarkdownExport); no heading-level shifting —
 * each doc keeps its own H1, same "independently H1-rooted page" model
 * buildSite already uses, just concatenated with a thematic-break separator
 * instead of split into separate HTML pages.
 */
export function buildWorkspaceMarkdownExport(input: PublishInput): MarkdownExportResult {
  const { documents, docTree, snippets, variables, conditionsFile, profile } = input
  const warnings: BuildWarning[] = []

  const byPath = new Map(documents.map((doc) => [doc.path.startsWith(`${DOCS_DIR}/`) ? doc.path.slice(DOCS_DIR.length + 1) : doc.path, doc]))
  const orderedDocs: IndexDocument[] = []
  collectDocsInTreeOrder(docTree, byPath, orderedDocs)

  const fragments: string[] = []
  for (const document of orderedDocs) {
    const filePath = document.path

    const conditionResult = filterConditions(document.text, filePath, profile, conditionsFile)
    warnings.push(...conditionResult.warnings)

    const rawBody = parseFrontmatter(document.text).body
    warnings.push(...nestingViolationsToBuildWarnings(findNestingViolations(rawBody, { variables, snippets }), filePath))

    const { body, warnings: fmWarnings } = parseFrontmatter(conditionResult.text)
    for (const message of fmWarnings) warnings.push({ type: 'frontmatter', file: filePath, message })

    const resolved = resolveDocument(body, { variables, snippets, mode: 'plain' })
    for (const w of resolved.warnings) warnings.push({ type: w.type, file: filePath, message: w.message })

    fragments.push(resolved.text.trim())
  }

  return { text: fragments.join(DOC_SEPARATOR), warnings }
}

/**
 * Mirrors buildPublication but emits plain markdown instead of one HTML
 * page: each heading node becomes an ATX heading at its tree-depth level,
 * each doc node is resolved/filtered the same way buildPublication resolves
 * it and has its own headings shifted to nest correctly beneath its tree
 * position (shiftHeadingLevels, reused verbatim — already markdown-in/
 * markdown-out). This is the "one flowing document" export, the more
 * useful of the two shapes for pasting a curated multi-doc guide into
 * Google Docs or an AI tool.
 */
export function buildPublicationMarkdownExport(input: PublicationBuildInput): MarkdownExportResult {
  const { publication, sourcePath, documents, snippets, variables, conditionsFile, profile } = input
  const warnings: BuildWarning[] = []

  const byPath = new Map(documents.map((doc) => [doc.path, doc]))
  const flat = flattenPublication(publication.nodes)
  const fragments: string[] = []

  for (const node of flat) {
    if (node.levelClamped) {
      const label = node.type === 'doc' ? node.ref : node.title
      warnings.push({
        type: 'heading-level-exceeds-h6',
        file: sourcePath,
        message: `"${label}" sits deeper than 6 levels in the publication tree and was capped at H6.`,
      })
    }

    if (node.type === 'heading') {
      const title = substituteTitleVariables(node.title, variables)
      fragments.push(`${'#'.repeat(node.level)} ${title}`)
      continue
    }

    const document = byPath.get(node.ref)
    if (!document) {
      warnings.push({
        type: 'missing-publication-doc',
        file: sourcePath,
        message: `Publication references "${node.ref}", which was not found in docs/.`,
      })
      continue
    }

    const conditionResult = filterConditions(document.text, document.path, profile, conditionsFile)
    warnings.push(...conditionResult.warnings)

    const rawBody = parseFrontmatter(document.text).body
    warnings.push(...nestingViolationsToBuildWarnings(findNestingViolations(rawBody, { variables, snippets }), document.path))

    const { body, warnings: fmWarnings } = parseFrontmatter(conditionResult.text)
    for (const message of fmWarnings) warnings.push({ type: 'frontmatter', file: document.path, message })

    const resolved = resolveDocument(body, { variables, snippets, mode: 'plain' })
    for (const w of resolved.warnings) warnings.push({ type: w.type, file: document.path, message: w.message })

    const shifted = shiftHeadingLevels(resolved.text, node.level, document.path)
    for (const w of shifted.warnings) warnings.push({ type: w.type, file: w.file, message: w.message })

    fragments.push(shifted.text.trim())
  }

  return { text: fragments.join('\n\n'), warnings }
}
