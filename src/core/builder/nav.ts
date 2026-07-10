import { relativePath } from '../workspace/paths'
import type { DocTreeNode } from '../workspace/types'

/** "guides/installation.md" -> "guides/installation.html" */
export function docPathToOutputPath(docRelPath: string): string {
  return docRelPath.endsWith('.md') ? `${docRelPath.slice(0, -3)}.html` : docRelPath
}

export type NavNode =
  | { kind: 'folder'; title: string; children: NavNode[] }
  | { kind: 'file'; title: string; href: string; active: boolean }

/**
 * Builds the published site's nav tree from the same DocTreeNode hierarchy
 * the sidebar uses (folder titles/order already resolved via _folder.json),
 * with hrefs made relative to whichever page is currently being rendered.
 */
export function buildNav(
  tree: DocTreeNode[],
  currentOutputPath: string,
  titleFor: (docRelPath: string) => string,
): NavNode[] {
  return tree.map((node): NavNode => {
    if (node.kind === 'folder') {
      return { kind: 'folder', title: node.name, children: buildNav(node.children ?? [], currentOutputPath, titleFor) }
    }
    const outputPath = docPathToOutputPath(node.path)
    return {
      kind: 'file',
      title: titleFor(node.path) || node.name,
      href: relativePath(currentOutputPath, outputPath),
      active: outputPath === currentOutputPath,
    }
  })
}
