import { setFrontmatterField } from '../core/frontmatter/update'
import { parseFrontmatter } from '../core/frontmatter/parse'
import { isPathWithin } from '../core/workspace/reorder'
import { FOLDER_META_FILE, SNIPPETS_DIR } from '../core/workspace/constants'
import { splitPath } from '../core/workspace/paths'
import type { FolderMeta, RawEntry } from '../core/workspace/types'
import {
  copyDirectory,
  FsWriteError,
  listDirectory,
  pathExists,
  readTextFile,
  renameFile,
  resolveDirectoryHandle,
  writeTextFile,
} from './directory'

function wrapError(message: string, cause: unknown): FsWriteError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new FsWriteError(`${message}: ${detail}`, { cause })
}

export interface WalkResult {
  entries: RawEntry[]
  folderMeta: Map<string, FolderMeta>
  fileOrder: Map<string, number>
}

async function walkFull(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  entries: RawEntry[],
  folderMeta: Map<string, FolderMeta>,
  fileOrder: Map<string, number>,
): Promise<void> {
  const listing = await listDirectory(dir)
  await Promise.all(
    listing.map(async (item) => {
      const path = prefix ? `${prefix}/${item.name}` : item.name

      if (item.kind === 'directory') {
        entries.push({ path, kind: 'directory' })
        const childHandle = await dir.getDirectoryHandle(item.name)
        await walkFull(childHandle, path, entries, folderMeta, fileOrder)
        return
      }

      if (item.name === FOLDER_META_FILE) {
        try {
          const raw = await readTextFile(dir, item.name)
          folderMeta.set(prefix, JSON.parse(raw) as FolderMeta)
        } catch {
          // Malformed _folder.json is ignored (fail soft) — the folder just
          // falls back to its raw name and alphabetical ordering.
        }
        return
      }

      if (!item.name.endsWith('.md')) return
      entries.push({ path, kind: 'file' })

      try {
        const raw = await readTextFile(dir, item.name)
        const { frontmatter } = parseFrontmatter(raw)
        if (typeof frontmatter.order === 'number') {
          fileOrder.set(path, frontmatter.order)
        }
      } catch {
        // Unreadable file just falls back to alphabetical ordering.
      }
    }),
  )
}

/**
 * Recursively walks a workspace subtree (docs/ or snippets/), collecting the
 * flat entry list, any _folder.json sidecars, and any frontmatter `order`
 * field per .md file. Shared by both readDocTree and readSnippetList now
 * that both support folders.
 */
export async function walkMarkdownTree(dir: FileSystemDirectoryHandle): Promise<WalkResult> {
  const entries: RawEntry[] = []
  const folderMeta = new Map<string, FolderMeta>()
  const fileOrder = new Map<string, number>()
  await walkFull(dir, '', entries, folderMeta, fileOrder)
  return { entries, folderMeta, fileOrder }
}

async function listPathsRecursive(dir: FileSystemDirectoryHandle, prefix: string, entries: RawEntry[]): Promise<void> {
  const listing = await listDirectory(dir)
  await Promise.all(
    listing.map(async (item) => {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.kind === 'directory') {
        entries.push({ path, kind: 'directory' })
        const childHandle = await dir.getDirectoryHandle(item.name)
        await listPathsRecursive(childHandle, path, entries)
        return
      }
      if (item.name === FOLDER_META_FILE) return
      entries.push({ path, kind: 'file' })
    }),
  )
}

export async function createFolder(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  try {
    await resolveDirectoryHandle(dir, path, { create: true })
  } catch (error) {
    throw wrapError(`Could not create folder ${path}`, error)
  }
}

/**
 * Renames a folder by updating its display title in _folder.json only — the
 * physical directory name (and therefore every descendant's path) is left
 * untouched. Mirrors the existing title/physical-name split the sample
 * workspace already relies on (docs/guides/_folder.json titled "Guides").
 */
export async function renameFolder(dir: FileSystemDirectoryHandle, path: string, newTitle: string): Promise<void> {
  try {
    const metaPath = `${path}/${FOLDER_META_FILE}`
    let existing: FolderMeta = {}
    if (await pathExists(dir, metaPath)) {
      try {
        existing = JSON.parse(await readTextFile(dir, metaPath)) as FolderMeta
      } catch {
        existing = {}
      }
    }
    const updated: FolderMeta = { ...existing, title: newTitle }
    await writeTextFile(dir, metaPath, `${JSON.stringify(updated, null, 2)}\n`)
  } catch (error) {
    throw wrapError(`Could not rename folder ${path}`, error)
  }
}

/**
 * Deletes a folder, refusing (with a friendly error) unless it's empty of
 * everything but an optional _folder.json sidecar. Never cascades — callers
 * must move or delete real contents first.
 */
export async function deleteFolder(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  try {
    const folderHandle = await resolveDirectoryHandle(dir, path)
    const listing = await listDirectory(folderHandle)
    const realContent = listing.filter((item) => item.name !== FOLDER_META_FILE)
    if (realContent.length > 0) {
      throw new FsWriteError(`Folder "${path}" isn't empty — move or delete its contents first.`)
    }

    const segments = splitPath(path)
    const name = segments[segments.length - 1]
    const parentHandle = await resolveDirectoryHandle(dir, segments.slice(0, -1).join('/'))
    // recursive: true only to sweep the harmless _folder.json sidecar just
    // confirmed above — not a general cascading-delete escape hatch.
    await parentHandle.removeEntry(name, { recursive: true })
  } catch (error) {
    if (error instanceof FsWriteError) throw error
    throw wrapError(`Could not delete folder ${path}`, error)
  }
}

/** Moves a document or snippet into a different folder (or to the root when toFolderPath is ''). Returns the new path. */
export async function moveFile(
  dir: FileSystemDirectoryHandle,
  fromPath: string,
  toFolderPath: string,
): Promise<string> {
  const segments = splitPath(fromPath)
  const filename = segments[segments.length - 1]
  const toPath = toFolderPath ? `${toFolderPath}/${filename}` : filename
  if (toPath === fromPath) return toPath
  try {
    await renameFile(dir, fromPath, toPath)
    return toPath
  } catch (error) {
    throw wrapError(`Could not move ${fromPath}`, error)
  }
}

/** Moves an entire folder subtree to a new parent (or to the root when toParentPath is ''). Returns the new path. */
export async function moveFolder(
  dir: FileSystemDirectoryHandle,
  fromPath: string,
  toParentPath: string,
): Promise<string> {
  const segments = splitPath(fromPath)
  const name = segments[segments.length - 1]
  const toPath = toParentPath ? `${toParentPath}/${name}` : name
  if (toPath === fromPath) return toPath
  if (isPathWithin(fromPath, toPath)) {
    throw new FsWriteError(`Can't move "${fromPath}" into itself or one of its own subfolders.`)
  }
  try {
    await copyDirectory(dir, fromPath, toPath)
    const parentHandle = await resolveDirectoryHandle(dir, segments.slice(0, -1).join('/'))
    await parentHandle.removeEntry(name, { recursive: true })
    return toPath
  } catch (error) {
    throw wrapError(`Could not move folder ${fromPath}`, error)
  }
}

/** Workspace-wide snippet-name uniqueness check — {{> name}} resolves by filename stem regardless of folder. */
export async function snippetStemExists(
  rootHandle: FileSystemDirectoryHandle,
  stem: string,
  excludePath?: string,
): Promise<boolean> {
  const snippetsHandle = await rootHandle.getDirectoryHandle(SNIPPETS_DIR, { create: true })
  const entries: RawEntry[] = []
  await listPathsRecursive(snippetsHandle, '', entries)
  return entries.some((entry) => {
    if (entry.kind !== 'file' || !entry.path.endsWith('.md')) return false
    if (excludePath !== undefined && entry.path === excludePath) return false
    const name = entry.path.split('/').pop() ?? entry.path
    return name.slice(0, -3) === stem
  })
}

/**
 * Renumbers a full sibling list after a drag-drop reorder, writing each
 * entry's position as its `order` — files via their frontmatter, folders
 * via their _folder.json (title preserved).
 */
export async function writeSiblingOrder(
  dir: FileSystemDirectoryHandle,
  entries: Array<{ path: string; kind: 'file' | 'folder' }>,
): Promise<void> {
  await Promise.all(
    entries.map(async (entry, index) => {
      if (entry.kind === 'folder') {
        const metaPath = `${entry.path}/${FOLDER_META_FILE}`
        let existing: FolderMeta = {}
        if (await pathExists(dir, metaPath)) {
          try {
            existing = JSON.parse(await readTextFile(dir, metaPath)) as FolderMeta
          } catch {
            existing = {}
          }
        }
        const updated: FolderMeta = { ...existing, order: index }
        await writeTextFile(dir, metaPath, `${JSON.stringify(updated, null, 2)}\n`)
      } else {
        const raw = await readTextFile(dir, entry.path)
        await writeTextFile(dir, entry.path, setFrontmatterField(raw, 'order', index))
      }
    }),
  )
}
