import type { PublicationNode } from './types'

/** Depth-first list of every `doc` node's `ref` in a publication's tree, in document order. */
export function collectDocRefs(nodes: PublicationNode[]): string[] {
  const refs: string[] = []
  for (const node of nodes) {
    if (node.type === 'doc') {
      refs.push(node.ref)
    } else if (node.children) {
      refs.push(...collectDocRefs(node.children))
    }
  }
  return refs
}

/** Total node count in a publication's tree (doc and heading nodes alike), recursively. */
export function countNodes(nodes: PublicationNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    if (node.type === 'heading' && node.children) count += countNodes(node.children)
  }
  return count
}
