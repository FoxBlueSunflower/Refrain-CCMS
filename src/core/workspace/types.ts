export interface PublishProfile {
  audience: string[]
  output: string[]
}

export interface WorkspaceConfig {
  name: string
  site: {
    title: string
    logo?: string
  }
  publishProfiles: Record<string, PublishProfile>
  formatVersion: number
}

export interface VariableEntry {
  value: string
  description: string
}

export type VariablesFile = Record<string, VariableEntry>

export interface ConditionsFile {
  audience: string[]
  output: string[]
}

export interface FolderMeta {
  title?: string
  order?: number
}

export type DocTreeNodeKind = 'file' | 'folder'

export interface DocTreeNode {
  kind: DocTreeNodeKind
  /** Display label, derived from filename (Phase 1) — not parsed from frontmatter. */
  name: string
  /** Path relative to the workspace's docs/ folder. */
  path: string
  children?: DocTreeNode[]
}

/** A flat directory-walk result, relative to the workspace's docs/ folder. */
export interface RawEntry {
  path: string
  kind: 'file' | 'directory'
}
