import type { PublicationNode } from './types'

/** Indices from the root array, descending through a node's `children`. `[2, 0]` = first child of the third root node. */
export type NodePath = number[]

function childrenOf(node: PublicationNode): PublicationNode[] {
  return node.children ?? []
}

function withChildren(node: PublicationNode, children: PublicationNode[]): PublicationNode {
  return { ...node, children }
}

/** Reads the node at `path`, or undefined if the path doesn't resolve. */
export function getNodeAt(nodes: PublicationNode[], path: NodePath): PublicationNode | undefined {
  if (path.length === 0) return undefined
  const [index, ...rest] = path
  const node = nodes[index]
  if (!node) return undefined
  if (rest.length === 0) return node
  return getNodeAt(childrenOf(node), rest)
}

/** Removes the node at `path`, returning the new tree. No-op (returns `nodes` unchanged) if the path doesn't resolve. */
export function removeNode(nodes: PublicationNode[], path: NodePath): PublicationNode[] {
  if (path.length === 0) return nodes
  const [index, ...rest] = path
  const node = nodes[index]
  if (!node) return nodes

  if (rest.length === 0) {
    return [...nodes.slice(0, index), ...nodes.slice(index + 1)]
  }

  const nextChildren = removeNode(childrenOf(node), rest)
  return [...nodes.slice(0, index), withChildren(node, nextChildren), ...nodes.slice(index + 1)]
}

/**
 * Inserts `node` at `index` within the array addressed by `parentPath` (`[]`
 * means the root array). No-op if `parentPath` doesn't resolve to a node —
 * both `doc` and `heading` nodes can hold children.
 */
export function insertNode(
  nodes: PublicationNode[],
  parentPath: NodePath,
  index: number,
  node: PublicationNode,
): PublicationNode[] {
  if (parentPath.length === 0) {
    const clamped = Math.max(0, Math.min(index, nodes.length))
    return [...nodes.slice(0, clamped), node, ...nodes.slice(clamped)]
  }

  const [head, ...rest] = parentPath
  const target = nodes[head]
  if (!target) return nodes

  if (rest.length === 0) {
    const children = childrenOf(target)
    const clamped = Math.max(0, Math.min(index, children.length))
    const nextChildren = [...children.slice(0, clamped), node, ...children.slice(clamped)]
    return [...nodes.slice(0, head), withChildren(target, nextChildren), ...nodes.slice(head + 1)]
  }

  const nextChildren = insertNode(childrenOf(target), rest, index, node)
  return [...nodes.slice(0, head), withChildren(target, nextChildren), ...nodes.slice(head + 1)]
}

function samePath(a: NodePath, b: NodePath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * After removing the node at `removedPath`, any other path that addresses a
 * later sibling in that same array has a stale index — this shifts it down
 * by one. Paths outside that array (a different branch of the tree
 * entirely) are returned unchanged.
 */
function adjustPathAfterRemoval(path: NodePath, removedPath: NodePath): NodePath {
  const removedParentPath = removedPath.slice(0, -1)
  const removedIndex = removedPath[removedPath.length - 1]
  if (path.length <= removedParentPath.length) return path
  if (!samePath(path.slice(0, removedParentPath.length), removedParentPath)) return path
  const indexAtLevel = path[removedParentPath.length]
  if (indexAtLevel <= removedIndex) return path
  const adjusted = [...path]
  adjusted[removedParentPath.length] = indexAtLevel - 1
  return adjusted
}

/**
 * Moves the node at `fromPath` to index `toIndex` within the array addressed
 * by `toParentPath`. When the move stays within the same parent array, the
 * target index is interpreted the same way `computeReorder` does (against
 * the sibling list with the dragged node already removed), so moving an item
 * later in its own list behaves intuitively. No-op if `fromPath` doesn't
 * resolve, or if `toParentPath` would nest a node inside itself.
 */
export function moveNode(nodes: PublicationNode[], fromPath: NodePath, toParentPath: NodePath, toIndex: number): PublicationNode[] {
  const moving = getNodeAt(nodes, fromPath)
  if (!moving) return nodes

  const fromParentPath = fromPath.slice(0, -1)
  const fromIndex = fromPath[fromPath.length - 1]

  // Guard against dropping a heading into its own subtree.
  if (toParentPath.length >= fromPath.length && samePath(toParentPath.slice(0, fromPath.length), fromPath)) {
    return nodes
  }

  if (samePath(fromParentPath, toParentPath)) {
    const siblings = fromParentPath.length === 0 ? nodes : childrenOf(getNodeAt(nodes, fromParentPath)!)
    const withoutMoving = [...siblings.slice(0, fromIndex), ...siblings.slice(fromIndex + 1)]
    const clamped = Math.max(0, Math.min(toIndex, withoutMoving.length))
    const nextSiblings = [...withoutMoving.slice(0, clamped), moving, ...withoutMoving.slice(clamped)]
    return replaceChildrenAt(nodes, fromParentPath, nextSiblings)
  }

  const without = removeNode(nodes, fromPath)
  const adjustedToParentPath = adjustPathAfterRemoval(toParentPath, fromPath)
  return insertNode(without, adjustedToParentPath, toIndex, moving)
}

function replaceChildrenAt(nodes: PublicationNode[], parentPath: NodePath, children: PublicationNode[]): PublicationNode[] {
  if (parentPath.length === 0) return children
  const [index, ...rest] = parentPath
  const node = nodes[index]
  if (!node) return nodes
  if (rest.length === 0) {
    return [...nodes.slice(0, index), withChildren(node, children), ...nodes.slice(index + 1)]
  }
  return [...nodes.slice(0, index), withChildren(node, replaceChildrenAt(childrenOf(node), rest, children)), ...nodes.slice(index + 1)]
}

/** Renames the heading node at `path`. No-op if the path resolves to a `doc` node (docs have no `title` to rename). */
export function renameHeading(nodes: PublicationNode[], path: NodePath, title: string): PublicationNode[] {
  if (path.length === 0) return nodes
  const [index, ...rest] = path
  const node = nodes[index]
  if (!node) return nodes

  if (rest.length === 0) {
    if (node.type !== 'heading') return nodes
    return [...nodes.slice(0, index), { ...node, title }, ...nodes.slice(index + 1)]
  }

  const nextChildren = renameHeading(childrenOf(node), rest, title)
  return [...nodes.slice(0, index), withChildren(node, nextChildren), ...nodes.slice(index + 1)]
}

/**
 * Reparents the node at `path` to become the last child of its immediately
 * preceding sibling. No-op if there is no preceding sibling — both `doc`
 * and `heading` siblings can hold children.
 */
export function indentNode(nodes: PublicationNode[], path: NodePath): PublicationNode[] {
  const index = path[path.length - 1]
  if (index === 0) return nodes
  const parentPath = path.slice(0, -1)
  const siblings = parentPath.length === 0 ? nodes : childrenOf(getNodeAt(nodes, parentPath)!)
  const prevSibling = siblings[index - 1]
  if (!prevSibling) return nodes
  const toParentPath = [...parentPath, index - 1]
  const toIndex = childrenOf(prevSibling).length
  return moveNode(nodes, path, toParentPath, toIndex)
}

/**
 * Moves the node at `path` to become a sibling immediately after its current
 * parent, one level up. No-op at the root (nothing to outdent from).
 */
export function outdentNode(nodes: PublicationNode[], path: NodePath): PublicationNode[] {
  if (path.length <= 1) return nodes
  const parentPath = path.slice(0, -1)
  const grandParentPath = parentPath.slice(0, -1)
  const toIndex = parentPath[parentPath.length - 1] + 1
  return moveNode(nodes, path, grandParentPath, toIndex)
}
