import { collectDocRefs } from '../publications/tree'
import { collectRefs, type ScannedRefs } from './scan'
import type { DocPublicationRef, IndexDocument, IndexInput, IndexPublication, IndexSnippet, WorkspaceIndex } from './types'

/**
 * Snippet transclusion is expanded at most two levels deep (doc -> snippet
 * -> snippet), matching MAX_SNIPPET_DEPTH in resolve.ts. A snippet's own
 * {{> name}} refs at the second level are recorded as "used by this doc" but
 * are not expanded further, since the resolver would refuse to expand them
 * too.
 */
const MAX_SNIPPET_LEVELS = 2

interface DocUsage {
  variables: Set<string>
  snippets: Set<string>
  conditions: Set<string>
}

function union(target: Set<string>, source: Set<string>): void {
  for (const value of source) target.add(value)
}

function collectDocUsage(doc: IndexDocument, snippetRefs: Map<string, ScannedRefs>): DocUsage {
  const direct = collectRefs(doc.text)
  const usage: DocUsage = {
    variables: new Set(direct.variables),
    snippets: new Set(),
    conditions: new Set(direct.conditions),
  }

  let frontier = direct.snippets
  for (let level = 0; level < MAX_SNIPPET_LEVELS && frontier.size > 0; level++) {
    const nextFrontier = new Set<string>()
    for (const name of frontier) {
      usage.snippets.add(name)
      const refs = snippetRefs.get(name)
      if (!refs) continue
      union(usage.variables, refs.variables)
      union(usage.conditions, refs.conditions)
      for (const nested of refs.snippets) nextFrontier.add(nested)
    }
    frontier = nextFrontier
  }

  return usage
}

function invert(entries: Array<readonly [string, Set<string>]>): Record<string, string[]> {
  const map = new Map<string, Set<string>>()
  for (const [docPath, keys] of entries) {
    for (const key of keys) {
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(docPath)
    }
  }
  const result: Record<string, string[]> = {}
  for (const [key, docPaths] of map) {
    result[key] = [...docPaths].sort()
  }
  return result
}

/** doc path -> publications that include it, sorted by publication title. */
function buildDocumentPublications(publications: IndexPublication[]): Record<string, DocPublicationRef[]> {
  const map = new Map<string, DocPublicationRef[]>()
  for (const pub of publications) {
    for (const ref of collectDocRefs(pub.nodes)) {
      const list = map.get(ref) ?? []
      list.push({ path: pub.path, title: pub.title })
      map.set(ref, list)
    }
  }
  const result: Record<string, DocPublicationRef[]> = {}
  for (const [docPath, refs] of map) {
    result[docPath] = refs.sort((a, b) => a.title.localeCompare(b.title))
  }
  return result
}

/**
 * Builds the where-used index: for every variable, snippet, and condition,
 * the sorted list of document paths that use it — directly, or transitively
 * through a transcluded snippet — plus, for every document, the publications
 * that include it.
 */
export function buildWorkspaceIndex(input: IndexInput, builtAt: string = new Date().toISOString()): WorkspaceIndex {
  const snippetRefs = new Map<string, ScannedRefs>(
    input.snippets.map((snippet: IndexSnippet) => [snippet.name, collectRefs(snippet.text)]),
  )

  const perDoc = input.documents.map((doc) => [doc.path, collectDocUsage(doc, snippetRefs)] as const)

  return {
    builtAt,
    variables: invert(perDoc.map(([path, usage]) => [path, usage.variables] as const)),
    snippets: invert(perDoc.map(([path, usage]) => [path, usage.snippets] as const)),
    conditions: invert(perDoc.map(([path, usage]) => [path, usage.conditions] as const)),
    documentPublications: buildDocumentPublications(input.publications ?? []),
  }
}
