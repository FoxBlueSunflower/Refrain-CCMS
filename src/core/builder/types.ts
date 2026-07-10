import type { IndexDocument } from '../indexer/types'
import type { SnippetSource } from '../resolver/types'
import type { ConditionsFile, DocTreeNode, PublishProfile, VariablesFile } from '../workspace/types'

export type BuildWarningType =
  | 'unknown-condition-dimension'
  | 'unknown-condition-value'
  | 'unclosed-condition-block'
  | 'missing-variable'
  | 'missing-snippet'
  | 'circular-snippet'
  | 'snippet-nesting-too-deep'
  | 'frontmatter'

/** A build-time problem worth surfacing to the writer. `line` is 1-indexed and only set for line-locatable warnings. */
export interface BuildWarning {
  type: BuildWarningType
  file: string
  line?: number
  message: string
}

/** A generated site file, `path` relative to the publish/ root (e.g. "guides/installation.html"). */
export interface BuiltFile {
  path: string
  contents: string
}

export interface PublishInput {
  documents: IndexDocument[]
  docTree: DocTreeNode[]
  snippets: SnippetSource
  variables: VariablesFile
  conditionsFile: ConditionsFile
  profile: PublishProfile
  siteTitle: string
}

export interface PublishResult {
  files: BuiltFile[]
  warnings: BuildWarning[]
}
