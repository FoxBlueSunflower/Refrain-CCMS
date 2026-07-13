export interface PublicationDocNode {
  type: 'doc'
  /** Path into docs/, e.g. "docs/guides/installation.md" — a pointer, not a copy. */
  ref: string
  children?: PublicationNode[]
}

export interface PublicationHeadingNode {
  type: 'heading'
  title: string
  children?: PublicationNode[]
}

export type PublicationNode = PublicationDocNode | PublicationHeadingNode

export interface Publication {
  title: string
  nodes: PublicationNode[]
}
