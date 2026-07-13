import type { PublicationNode } from './types'

const MAX_HEADING_LEVEL = 6

export interface FlatPublicationDocNode {
  type: 'doc'
  level: number
  ref: string
  levelClamped: boolean
}

export interface FlatPublicationHeadingNode {
  type: 'heading'
  level: number
  title: string
  levelClamped: boolean
}

export type FlatPublicationNode = FlatPublicationDocNode | FlatPublicationHeadingNode

function flattenAt(nodes: PublicationNode[], depth: number, out: FlatPublicationNode[]): void {
  for (const node of nodes) {
    const level = Math.min(depth, MAX_HEADING_LEVEL)
    const levelClamped = depth > MAX_HEADING_LEVEL

    if (node.type === 'doc') {
      out.push({ type: 'doc', level, ref: node.ref, levelClamped })
    } else {
      out.push({ type: 'heading', level, title: node.title, levelClamped })
    }
    if (node.children) flattenAt(node.children, depth + 1, out)
  }
}

/**
 * Depth-first flattening of a publication's tree (Phase 9c), assigning each
 * node a heading level equal to its tree depth (1-based). Depth only
 * increases through a node's `children` — both `doc` and `heading` nodes
 * may hold them; a doc node that merely follows a heading in the same array
 * (not nested inside its `children`, see SPEC.md's publication example) is
 * a sibling at the same depth, not implicitly nested under it. Depth beyond
 * H6 clamps to 6 (levelClamped: true) rather than implying an invalid
 * heading level — callers turn that into a BuildWarning.
 */
export function flattenPublication(nodes: PublicationNode[]): FlatPublicationNode[] {
  const out: FlatPublicationNode[] = []
  flattenAt(nodes, 1, out)
  return out
}
