import type { SnippetSource } from '../core/resolver/types'
import { FOLDER_META_FILE, SNIPPETS_DIR, VARIABLES_FILE } from '../core/workspace/constants'
import type { VariablesFile } from '../core/workspace/types'
import { validateVariablesFile } from '../core/workspace/validate'
import { listDirectory, readTextFile, writeTextFile } from './directory'

/** Fails soft to an empty table — a missing or malformed variables.json never blocks the preview. */
export async function readVariablesFile(dir: FileSystemDirectoryHandle): Promise<VariablesFile> {
  try {
    const raw = await readTextFile(dir, VARIABLES_FILE)
    const result = validateVariablesFile(JSON.parse(raw))
    return result.ok ? result.value : {}
  } catch {
    return {}
  }
}

export async function writeVariablesFile(dir: FileSystemDirectoryHandle, variables: VariablesFile): Promise<void> {
  await writeTextFile(dir, VARIABLES_FILE, `${JSON.stringify(variables, null, 2)}\n`)
}

async function walkSnippets(
  dir: FileSystemDirectoryHandle,
  entries: Array<readonly [string, string]>,
): Promise<void> {
  const listing = await listDirectory(dir)
  await Promise.all(
    listing.map(async (item) => {
      if (item.kind === 'directory') {
        const childHandle = await dir.getDirectoryHandle(item.name)
        await walkSnippets(childHandle, entries)
        return
      }
      if (item.name === FOLDER_META_FILE || !item.name.endsWith('.md')) return
      const contents = await readTextFile(dir, item.name)
      entries.push([item.name.slice(0, -3), contents])
    }),
  )
}

/**
 * Reads every snippets/**\/*.md file (recursively — snippets may be organized
 * into folders), keyed by filename stem — the identity {{> name}} resolves
 * against, independent of which folder the snippet lives in.
 */
export async function readAllSnippets(dir: FileSystemDirectoryHandle): Promise<SnippetSource> {
  const snippetsHandle = await dir.getDirectoryHandle(SNIPPETS_DIR, { create: true })
  const entries: Array<readonly [string, string]> = []
  await walkSnippets(snippetsHandle, entries)
  return Object.fromEntries(entries)
}
