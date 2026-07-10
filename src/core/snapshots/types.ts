export type SnapshotKind = 'publish' | 'manual' | 'restore'

/** path is workspace-relative: "docs/guides/x.md", "snippets/warning-banner.md", "variables.json", "conditions.json" */
export interface SnapshotFile {
  path: string
  contents: string
}

export interface SnapshotDiff {
  added: string[]
  updated: string[]
  removed: string[]
}

export interface PublishLogEntry {
  at: string
  profile: string
  snapshot: string
  changes: SnapshotDiff
}

export type PublishLog = PublishLogEntry[]

export interface VariableDiscrepancy {
  key: string
  before?: string
  after?: string
}

export interface ConditionDiscrepancy {
  dimension: string
  before?: string[]
  after?: string[]
}
