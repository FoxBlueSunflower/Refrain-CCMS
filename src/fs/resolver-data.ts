import type { SnippetSource } from '../core/resolver/types'
import { SNIPPETS_DIR, VARIABLES_FILE } from '../core/workspace/constants'
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

/** Reads every snippets/*.md file, keyed by filename stem — the identity {{> name}} resolves against. */
export async function readAllSnippets(dir: FileSystemDirectoryHandle): Promise<SnippetSource> {
  const snippetsHandle = await dir.getDirectoryHandle(SNIPPETS_DIR, { create: true })
  const listing = await listDirectory(snippetsHandle)
  const entries = await Promise.all(
    listing
      .filter((item) => item.kind === 'file' && item.name.endsWith('.md'))
      .map(async (item) => {
        const contents = await readTextFile(snippetsHandle, item.name)
        return [item.name.slice(0, -3), contents] as const
      }),
  )
  return Object.fromEntries(entries)
}
