/** True if `candidate` is `parent` itself or nested under it. Guards against
 *  dragging a folder into its own descendant. */
export function isPathWithin(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}/`)
}

/**
 * Removes `draggedPath` from `siblingPaths` (if present) and reinserts it at
 * `targetIndex`, returning the new order. Pure — used to compute the write
 * plan for a sidebar drag-drop reorder.
 */
export function computeReorder(siblingPaths: string[], draggedPath: string, targetIndex: number): string[] {
  const withoutDragged = siblingPaths.filter((path) => path !== draggedPath)
  const clampedIndex = Math.max(0, Math.min(targetIndex, withoutDragged.length))
  return [...withoutDragged.slice(0, clampedIndex), draggedPath, ...withoutDragged.slice(clampedIndex)]
}
