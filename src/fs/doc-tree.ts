import { DOCS_DIR, SNIPPETS_DIR } from '../core/workspace/constants'
import { buildDocTree } from '../core/workspace/tree'
import type { DocTreeNode } from '../core/workspace/types'
import { walkMarkdownTree } from './folders'

/** Walks the workspace's docs/ folder and builds the sidebar tree. */
export async function readDocTree(rootHandle: FileSystemDirectoryHandle): Promise<DocTreeNode[]> {
  const docsHandle = await rootHandle.getDirectoryHandle(DOCS_DIR, { create: true })
  const { entries, folderMeta, fileOrder } = await walkMarkdownTree(docsHandle)
  return buildDocTree(entries, folderMeta, fileOrder)
}

/** Walks the workspace's snippets/ folder and builds the sidebar tree. Snippets may be organized into folders for tidiness, but {{> name}} always resolves by filename stem, workspace-wide, regardless of folder. */
export async function readSnippetList(rootHandle: FileSystemDirectoryHandle): Promise<DocTreeNode[]> {
  const snippetsHandle = await rootHandle.getDirectoryHandle(SNIPPETS_DIR, { create: true })
  const { entries, folderMeta, fileOrder } = await walkMarkdownTree(snippetsHandle)
  return buildDocTree(entries, folderMeta, fileOrder)
}
