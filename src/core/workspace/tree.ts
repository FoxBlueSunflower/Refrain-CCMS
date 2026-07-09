import { splitPath } from './paths'
import type { DocTreeNode, FolderMeta, RawEntry } from './types'

function labelFor(filename: string): string {
  return filename.endsWith('.md') ? filename.slice(0, -3) : filename
}

/**
 * Builds a sorted, nested document tree for the sidebar from a flat list of
 * docs/-relative entries plus any parsed _folder.json metadata.
 *
 * Phase 1 does not parse markdown frontmatter, so document labels are
 * filenames (minus .md) and only folders can carry an explicit sort order.
 */
export function buildDocTree(entries: RawEntry[], folderMeta: Map<string, FolderMeta>): DocTreeNode[] {
  const root: DocTreeNode[] = []
  const foldersByPath = new Map<string, DocTreeNode>()

  function ensureFolder(path: string): DocTreeNode {
    const existing = foldersByPath.get(path)
    if (existing) return existing

    const segments = splitPath(path)
    const name = segments[segments.length - 1]
    const meta = folderMeta.get(path)
    const node: DocTreeNode = { kind: 'folder', name: meta?.title ?? name, path, children: [] }
    foldersByPath.set(path, node)

    if (segments.length === 1) {
      root.push(node)
    } else {
      const parent = ensureFolder(segments.slice(0, -1).join('/'))
      parent.children!.push(node)
    }
    return node
  }

  for (const entry of entries.filter((e) => e.kind === 'directory')) {
    ensureFolder(entry.path)
  }

  for (const entry of entries.filter((e) => e.kind === 'file' && e.path.endsWith('.md'))) {
    const segments = splitPath(entry.path)
    const name = segments[segments.length - 1]
    const node: DocTreeNode = { kind: 'file', name: labelFor(name), path: entry.path }

    if (segments.length === 1) {
      root.push(node)
    } else {
      const parent = ensureFolder(segments.slice(0, -1).join('/'))
      parent.children!.push(node)
    }
  }

  return sortTree(root, folderMeta)
}

function sortTree(nodes: DocTreeNode[], folderMeta: Map<string, FolderMeta>): DocTreeNode[] {
  const orderOf = (node: DocTreeNode): number | undefined =>
    node.kind === 'folder' ? folderMeta.get(node.path)?.order : undefined

  const withOrder = nodes.filter((n) => orderOf(n) !== undefined).sort((a, b) => orderOf(a)! - orderOf(b)!)
  const withoutOrder = nodes.filter((n) => orderOf(n) === undefined).sort((a, b) => a.name.localeCompare(b.name))

  return [...withOrder, ...withoutOrder].map((node) =>
    node.children ? { ...node, children: sortTree(node.children, folderMeta) } : node,
  )
}
