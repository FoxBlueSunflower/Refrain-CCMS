import type { DocPublicationRef, WorkspaceIndex } from './types'

/**
 * The deduped, title-sorted union of publications that include any of
 * `docPaths` — used to answer "which publications is this variable/snippet
 * used in" by fanning out through its document list. Not persisted on
 * WorkspaceIndex (and so not written to .app/index.json) since it's cheaply
 * derivable from documentPublications on every read.
 */
export function publicationsForDocuments(index: WorkspaceIndex, docPaths: string[]): DocPublicationRef[] {
  const byPath = new Map<string, DocPublicationRef>()
  for (const docPath of docPaths) {
    for (const ref of index.documentPublications[docPath] ?? []) {
      byPath.set(ref.path, ref)
    }
  }
  return [...byPath.values()].sort((a, b) => a.title.localeCompare(b.title))
}
