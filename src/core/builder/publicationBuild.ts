import { Marked } from 'marked'
import { parseFrontmatter } from '../frontmatter/parse'
import { flattenPublication } from '../publications/flatten'
import type { Publication } from '../publications/types'
import { resolveDocument } from '../resolver/resolve'
import type { SnippetSource } from '../resolver/types'
import { DOCS_DIR, PUBLICATIONS_DIR } from '../workspace/constants'
import type { ConditionsFile, PublishProfile, VariablesFile } from '../workspace/types'
import type { IndexDocument } from '../indexer/types'
import { filterConditions } from './conditions'
import { buildHomePage } from './home-page'
import { createLinkRewritingRenderer } from './site'
import { escapeHtml, renderPage } from './html-template'
import { shiftHeadingLevels } from './headingShift'
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
  siteTitle: string
}

/** "user-guide" -> "publications/user-guide.html", relative to the publish/ root. */
export function publicationOutputPath(slug: string): string {
  return `${PUBLICATIONS_DIR}/${slug}.html`
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
 */
export function buildPublication(input: PublicationBuildInput): PublishResult {
  const { publication, sourcePath, slug, documents, snippets, variables, conditionsFile, profile, siteTitle } = input
  const warnings: BuildWarning[] = []
  const outputPath = publicationOutputPath(slug)

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
      const title = escapeHtml(substituteTitleVariables(node.title, variables))
      fragments.push(`<h${node.level}>${title}</h${node.level}>`)
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

    const docRelPath = document.path.startsWith(`${DOCS_DIR}/`) ? document.path.slice(DOCS_DIR.length + 1) : document.path

    const conditionResult = filterConditions(document.text, document.path, profile, conditionsFile)
    warnings.push(...conditionResult.warnings)

    const { body, warnings: fmWarnings } = parseFrontmatter(conditionResult.text)
    for (const message of fmWarnings) warnings.push({ type: 'frontmatter', file: document.path, message })

    const resolved = resolveDocument(body, { variables, snippets })
    for (const w of resolved.warnings) warnings.push({ type: w.type, file: document.path, message: w.message })

    // shiftHeadingLevels runs on already-resolved text (frontmatter stripped,
    // {{key}}/{{> snippet}} expanded), so its line numbers don't correspond to
    // the writer's actual file — drop `line` rather than report a misleading one.
    const shifted = shiftHeadingLevels(resolved.text, node.level, document.path)
    for (const w of shifted.warnings) warnings.push({ type: w.type, file: w.file, message: w.message })

    const engine = new Marked({ renderer: createLinkRewritingRenderer(docRelPath, outputPath) })
    fragments.push(engine.parse(shifted.text, { async: false }) as string)
  }

  const bodyHtml = fragments.join('\n')
  const pageTitle = substituteTitleVariables(publication.title, variables)
  const contents = renderPage({ siteTitle, pageTitle, bodyHtml, nav: [], searchEntries: [] })

  const file: BuiltFile = { path: outputPath, contents }
  const homeFile = buildHomePage({
    siteTitle,
    nav: [{ kind: 'file', title: pageTitle, href: outputPath, active: false }],
    searchIndex: [],
  })
  return { files: [file], homeFile, warnings }
}
