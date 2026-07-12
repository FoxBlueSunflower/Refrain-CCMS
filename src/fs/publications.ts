import { countNodes } from '../core/publications/tree'
import type { Publication, PublicationNode } from '../core/publications/types'
import { validatePublication } from '../core/publications/validate'
import { PUBLICATIONS_DIR } from '../core/workspace/constants'
import { slugify } from '../core/workspace/paths'
import type { ValidationResult } from '../core/workspace/validate'
import { deleteEntry, listDirectory, pathExists, readTextFile, resolveDirectoryHandle, writeTextFile } from './directory'

export interface PublicationSummary {
  /** Filename relative to publications/, e.g. "user-guide.json". */
  path: string
  title: string
  nodeCount: number
}

export interface PublicationRefs {
  /** Filename relative to publications/, e.g. "user-guide.json". */
  path: string
  title: string
  nodes: PublicationNode[]
}

async function readValidPublication(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<{ path: string; publication: Publication } | null> {
  try {
    const raw = await readTextFile(dirHandle, fileName)
    const result = validatePublication(JSON.parse(raw))
    return result.ok ? { path: fileName, publication: result.value } : null
  } catch {
    // Malformed publication file — skipped rather than crashing the panel.
    return null
  }
}

async function readAllValidPublications(
  rootHandle: FileSystemDirectoryHandle,
): Promise<Array<{ path: string; publication: Publication }>> {
  const dirHandle = await resolveDirectoryHandle(rootHandle, PUBLICATIONS_DIR, { create: true })
  const listing = await listDirectory(dirHandle)
  const jsonFiles = listing.filter((entry) => entry.kind === 'file' && entry.name.endsWith('.json'))

  const results = await Promise.all(jsonFiles.map((entry) => readValidPublication(dirHandle, entry.name)))
  return results.filter((r): r is { path: string; publication: Publication } => r !== null)
}

/** Lists every publication under publications/, sorted by title. Malformed files are skipped (fail-soft, same as _folder.json). */
export async function readAllPublications(rootHandle: FileSystemDirectoryHandle): Promise<PublicationSummary[]> {
  const results = await readAllValidPublications(rootHandle)
  return results
    .map(({ path, publication }) => ({ path, title: publication.title, nodeCount: countNodes(publication.nodes) }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** Same as readAllPublications, but carries the full node tree — used to build the doc-to-publications where-used index. */
export async function readAllPublicationRefs(rootHandle: FileSystemDirectoryHandle): Promise<PublicationRefs[]> {
  const results = await readAllValidPublications(rootHandle)
  return results.map(({ path, publication }) => ({ path, title: publication.title, nodes: publication.nodes }))
}

export async function readPublication(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
): Promise<ValidationResult<Publication>> {
  try {
    const raw = await readTextFile(rootHandle, `${PUBLICATIONS_DIR}/${path}`)
    return validatePublication(JSON.parse(raw))
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] }
  }
}

export async function writePublication(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
  publication: Publication,
): Promise<void> {
  await writeTextFile(rootHandle, `${PUBLICATIONS_DIR}/${path}`, `${JSON.stringify(publication, null, 2)}\n`)
}

/** Finds a free publications/<slug>.json path, suffixing -2, -3, ... on collision. */
async function findUniquePublicationPath(rootHandle: FileSystemDirectoryHandle, base: string): Promise<string> {
  let candidate = `${base}.json`
  let n = 2
  while (await pathExists(rootHandle, `${PUBLICATIONS_DIR}/${candidate}`)) {
    candidate = `${base}-${n}.json`
    n += 1
  }
  return candidate
}

/** Creates a new, empty publication ({ title, nodes: [] }). Returns its path (relative to publications/) and contents, so callers don't need to re-read the file they just wrote. */
export async function createPublication(
  rootHandle: FileSystemDirectoryHandle,
  title: string,
): Promise<{ path: string; publication: Publication }> {
  const trimmed = title.trim() || 'untitled'
  const slug = slugify(trimmed) || 'untitled'
  const path = await findUniquePublicationPath(rootHandle, slug)
  const publication: Publication = { title: trimmed, nodes: [] }
  await writePublication(rootHandle, path, publication)
  return { path, publication }
}

export async function deletePublication(rootHandle: FileSystemDirectoryHandle, path: string): Promise<void> {
  await deleteEntry(rootHandle, `${PUBLICATIONS_DIR}/${path}`)
}
