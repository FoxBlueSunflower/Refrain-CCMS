export interface WorkspaceIndex {
  builtAt: string
  /** snippet name -> doc paths (relative to workspace root, e.g. "docs/guides/installation.md") that transclude it. */
  snippets: Record<string, string[]>
  /** variable key -> doc paths that reference it, directly or through a transcluded snippet. */
  variables: Record<string, string[]>
  /** "dimension=value" -> doc paths containing that condition block. */
  conditions: Record<string, string[]>
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

export interface IndexInput {
  documents: IndexDocument[]
  snippets: IndexSnippet[]
}
