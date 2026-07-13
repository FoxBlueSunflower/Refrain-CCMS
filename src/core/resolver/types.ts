import type { VariablesFile } from '../workspace/types'

export type ResolverWarningType = 'missing-variable' | 'missing-snippet' | 'circular-snippet' | 'snippet-nesting-too-deep'

export interface ResolverWarning {
  type: ResolverWarningType
  key: string
  message: string
}

/** Raw snippet file contents (frontmatter + body), keyed by filename stem — the identity {{> name}} refers to. */
export type SnippetSource = Record<string, string>

/** 'html' (default) wraps resolved values/errors in <span> markup for the published site; 'plain' emits bare text for the markdown export. */
export type ResolveMode = 'html' | 'plain'

export interface ResolveContext {
  variables: VariablesFile
  snippets: SnippetSource
  mode?: ResolveMode
}

export interface ResolveResult {
  text: string
  warnings: ResolverWarning[]
}
