import { DOCS_DIR, FOLDER_META_FILE, SNIPPETS_DIR } from '../core/workspace/constants'
import { buildDocTree } from '../core/workspace/tree'
import type { DocTreeNode, FolderMeta, RawEntry } from '../core/workspace/types'
import { listDirectory, readTextFile } from './directory'

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  entries: RawEntry[],
  folderMeta: Map<string, FolderMeta>,
): Promise<void> {
  const listing = await listDirectory(dir)
  for (const item of listing) {
    const path = prefix ? `${prefix}/${item.name}` : item.name

    if (item.kind === 'directory') {
      entries.push({ path, kind: 'directory' })
      const childHandle = await dir.getDirectoryHandle(item.name)
      await walk(childHandle, path, entries, folderMeta)
      continue
    }

    if (item.name === FOLDER_META_FILE) {
      try {
        const raw = await readTextFile(dir, item.name)
        folderMeta.set(prefix, JSON.parse(raw) as FolderMeta)
      } catch {
        // Malformed _folder.json is ignored (fail soft) — the folder just
        // falls back to its raw name and alphabetical ordering.
      }
      continue
    }

    entries.push({ path, kind: 'file' })
  }
}

/** Walks the workspace's docs/ folder and builds the sidebar tree. */
export async function readDocTree(rootHandle: FileSystemDirectoryHandle): Promise<DocTreeNode[]> {
  const docsHandle = await rootHandle.getDirectoryHandle(DOCS_DIR, { create: true })
  const entries: RawEntry[] = []
  const folderMeta = new Map<string, FolderMeta>()
  await walk(docsHandle, '', entries, folderMeta)
  return buildDocTree(entries, folderMeta)
}

/**
 * Lists the workspace's snippets/ folder. Per SPEC.md, snippets are a flat,
 * org-wide collection (no subfolders), so this is a plain sorted file list
 * rather than a recursive tree walk.
 */
export async function readSnippetList(rootHandle: FileSystemDirectoryHandle): Promise<DocTreeNode[]> {
  const snippetsHandle = await rootHandle.getDirectoryHandle(SNIPPETS_DIR, { create: true })
  const listing = await listDirectory(snippetsHandle)
  const entries: RawEntry[] = listing
    .filter((item) => item.kind === 'file' && item.name.endsWith('.md'))
    .map((item) => ({ path: item.name, kind: 'file' as const }))
  return buildDocTree(entries, new Map())
}
