import type { PublicationNode } from '../publications/types'

export interface WorkspaceIndex {
  builtAt: string
  /** snippet name -> doc paths (relative to workspace root, e.g. "docs/guides/installation.md") that transclude it. */
  snippets: Record<string, string[]>
  /** variable key -> doc paths that reference it, directly or through a transcluded snippet. */
  variables: Record<string, string[]>
  /** "dimension=value" -> doc paths containing that condition block. */
  conditions: Record<string, string[]>
  /** doc path -> publications that include it as a node (reverse direction from the three fields above). */
  documentPublications: Record<string, DocPublicationRef[]>
  /** snippet name -> other snippet names whose body directly includes it via {{> name}} (one level; independent of whether either snippet is itself pulled into any document). */
  snippetsUsedBySnippets: Record<string, string[]>
  /** variable key -> snippet names whose body directly references {{key}} (one level; mirrors snippetsUsedBySnippets, independent of whether the snippet itself is pulled into any document). */
  variablesUsedBySnippets: Record<string, string[]>
}

/** A publication that includes a document, as surfaced in the document's where-used results. */
export interface DocPublicationRef {
  /** Filename relative to publications/, e.g. "user-guide.json" — matches PublicationSummary.path. */
  path: string
  title: string
}

/** A document's raw file contents (frontmatter + body), keyed by its workspace-relative path. */
export interface IndexDocument {
  path: string
  text: string
}

/** A snippet's raw file contents (frontmatter + body), keyed by its filename stem. */
export interface IndexSnippet {
  name: string
  text: string
}

/** A publication's node tree as fed into the indexer, keyed by its publications/ filename. */
export interface IndexPublication {
  path: string
  title: string
  nodes: PublicationNode[]
}

export interface IndexInput {
  documents: IndexDocument[]
  snippets: IndexSnippet[]
  /** Optional so existing callers that only care about snippet/variable/condition indexing don't need updating. */
  publications?: IndexPublication[]
}
