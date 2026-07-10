import type { IndexDocument } from '../core/indexer/types'
import { DOCS_DIR, FOLDER_META_FILE } from '../core/workspace/constants'
import { listDirectory, readTextFile } from './directory'

async function walk(dir: FileSystemDirectoryHandle, prefix: string, documents: IndexDocument[]): Promise<void> {
  const listing = await listDirectory(dir)
  for (const item of listing) {
    const path = prefix ? `${prefix}/${item.name}` : item.name

    if (item.kind === 'directory') {
      const childHandle = await dir.getDirectoryHandle(item.name)
      await walk(childHandle, path, documents)
      continue
    }

    if (item.name === FOLDER_META_FILE || !item.name.endsWith('.md')) continue

    const text = await readTextFile(dir, item.name)
    documents.push({ path: `${DOCS_DIR}/${path}`, text })
  }
}

/** Reads every document under docs/ (recursively) for indexing, keyed by workspace-relative path (e.g. "docs/guides/installation.md"). */
export async function readAllDocuments(rootHandle: FileSystemDirectoryHandle): Promise<IndexDocument[]> {
  const docsHandle = await rootHandle.getDirectoryHandle(DOCS_DIR, { create: true })
  const documents: IndexDocument[] = []
  await walk(docsHandle, '', documents)
  return documents
}
