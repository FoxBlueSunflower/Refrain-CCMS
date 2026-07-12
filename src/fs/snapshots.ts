import type { PublishLogEntry, SnapshotFile, SnapshotKind } from '../core/snapshots/types'
import { parseSnapshotDirName, snapshotDirName } from '../core/snapshots/naming'
import {
  APP_DIR,
  CONDITIONS_FILE,
  DOCS_DIR,
  PUBLICATIONS_DIR,
  SNIPPETS_DIR,
  TEMPLATES_DIR,
  VARIABLES_FILE,
} from '../core/workspace/constants'
import {
  clearDirectory,
  copyDirectory,
  copyFile,
  directoryExists,
  listDirectory,
  pathExists,
  readTextFile,
  writeTextFile,
} from './directory'
import { readAllDocuments } from './index-data'
import { readAllSnippets } from './resolver-data'

const HISTORY_DIR_NAME = 'history'
const HISTORY_DIR = `${APP_DIR}/${HISTORY_DIR_NAME}`
const PUBLISH_LOG_FILE = `${APP_DIR}/publish-log.json`

export interface SnapshotSummary {
  name: string
  timestamp: string
  kind: SnapshotKind
}

async function getHistoryHandle(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const appHandle = await dir.getDirectoryHandle(APP_DIR, { create: true })
  return appHandle.getDirectoryHandle(HISTORY_DIR_NAME, { create: true })
}

async function historyEntryExists(historyHandle: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await historyHandle.getDirectoryHandle(name)
    return true
  } catch {
    return false
  }
}

/**
 * Two snapshots of the same kind can land in the same minute (e.g. two
 * publishes in quick succession) — appends -2, -3, ... on collision so they
 * never merge into the same folder, same idiom as uniquePath in
 * WorkspaceShell.tsx for new-document filename collisions.
 */
async function uniqueSnapshotName(historyHandle: FileSystemDirectoryHandle, kind: SnapshotKind, at: Date): Promise<string> {
  const base = snapshotDirName(kind, at)
  if (!(await historyEntryExists(historyHandle, base))) return base
  let n = 2
  while (await historyEntryExists(historyHandle, `${base}-${n}`)) {
    n += 1
  }
  return `${base}-${n}`
}

async function readOptionalText(rootHandle: FileSystemDirectoryHandle, path: string): Promise<string | null> {
  if (!(await pathExists(rootHandle, path))) return null
  return readTextFile(rootHandle, path)
}

/**
 * Reads docs/, snippets/, variables.json, and conditions.json from `rootHandle`
 * as a flat SnapshotFile[]. Reuses readAllDocuments/readAllSnippets (which
 * only ever look for DOCS_DIR/SNIPPETS_DIR under whatever handle they're
 * given) so this works identically whether `rootHandle` is the live
 * workspace root or a `.app/history/<name>/` snapshot folder.
 */
async function readTreeSnapshotFiles(rootHandle: FileSystemDirectoryHandle): Promise<SnapshotFile[]> {
  const [documents, snippetSource, variablesText, conditionsText] = await Promise.all([
    readAllDocuments(rootHandle),
    readAllSnippets(rootHandle),
    readOptionalText(rootHandle, VARIABLES_FILE),
    readOptionalText(rootHandle, CONDITIONS_FILE),
  ])

  const files: SnapshotFile[] = documents.map((doc) => ({ path: doc.path, contents: doc.text }))
  for (const [name, text] of Object.entries(snippetSource)) {
    files.push({ path: `${SNIPPETS_DIR}/${name}.md`, contents: text })
  }
  if (variablesText !== null) files.push({ path: VARIABLES_FILE, contents: variablesText })
  if (conditionsText !== null) files.push({ path: CONDITIONS_FILE, contents: conditionsText })
  return files
}

/** Copies docs/, snippets/, templates/, publications/, variables.json, and conditions.json into a new .app/history/<timestamp>_<kind>/ folder. Returns the new folder's name. */
export async function writeSnapshot(
  dir: FileSystemDirectoryHandle,
  kind: SnapshotKind,
  at: Date = new Date(),
): Promise<string> {
  const historyHandle = await getHistoryHandle(dir)
  const name = await uniqueSnapshotName(historyHandle, kind, at)
  const base = `${HISTORY_DIR}/${name}`
  await copyDirectory(dir, DOCS_DIR, `${base}/${DOCS_DIR}`)
  await copyDirectory(dir, SNIPPETS_DIR, `${base}/${SNIPPETS_DIR}`)
  await copyDirectory(dir, TEMPLATES_DIR, `${base}/${TEMPLATES_DIR}`)
  await copyDirectory(dir, PUBLICATIONS_DIR, `${base}/${PUBLICATIONS_DIR}`)
  if (await pathExists(dir, VARIABLES_FILE)) await copyFile(dir, VARIABLES_FILE, `${base}/${VARIABLES_FILE}`)
  if (await pathExists(dir, CONDITIONS_FILE)) await copyFile(dir, CONDITIONS_FILE, `${base}/${CONDITIONS_FILE}`)
  return name
}

/** Lists every folder under .app/history/, newest first. Unparsable folder names are skipped rather than crashing. */
export async function listSnapshots(dir: FileSystemDirectoryHandle): Promise<SnapshotSummary[]> {
  const historyHandle = await getHistoryHandle(dir)
  const listing = await listDirectory(historyHandle)
  const summaries: SnapshotSummary[] = []
  for (const entry of listing) {
    if (entry.kind !== 'directory') continue
    const parsed = parseSnapshotDirName(entry.name)
    if (!parsed) continue
    summaries.push({ name: entry.name, timestamp: parsed.timestamp, kind: parsed.kind })
  }
  return summaries.sort((a, b) => b.name.localeCompare(a.name))
}

/** Reads a snapshot's docs/+snippets/+variables.json+conditions.json back out as a flat SnapshotFile[]. */
export async function readSnapshotFiles(dir: FileSystemDirectoryHandle, snapshotName: string): Promise<SnapshotFile[]> {
  const historyHandle = await getHistoryHandle(dir)
  const snapshotHandle = await historyHandle.getDirectoryHandle(snapshotName)
  return readTreeSnapshotFiles(snapshotHandle)
}

/** Reads the CURRENT live docs/+snippets/+variables.json+conditions.json, same shape as readSnapshotFiles. */
export async function readCurrentSnapshotFiles(dir: FileSystemDirectoryHandle): Promise<SnapshotFile[]> {
  return readTreeSnapshotFiles(dir)
}

/**
 * Restores a snapshot. First snapshots the CURRENT state (kind 'restore') so
 * nothing is ever destroyed, then overwrites docs/, snippets/, variables.json,
 * and conditions.json from the chosen snapshot. Returns the pre-restore
 * safety snapshot's name.
 *
 * templates/ and publications/ are restored only when the chosen snapshot
 * actually has one — snapshots taken before that folder existed have
 * nothing to restore it from, and unconditionally clearing the live folder
 * in that case would silently destroy current content with no way to bring
 * it back.
 */
export async function restoreSnapshot(dir: FileSystemDirectoryHandle, snapshotName: string): Promise<string> {
  const safetyName = await writeSnapshot(dir, 'restore')

  const base = `${HISTORY_DIR}/${snapshotName}`
  await clearDirectory(dir, DOCS_DIR)
  await clearDirectory(dir, SNIPPETS_DIR)
  await copyDirectory(dir, `${base}/${DOCS_DIR}`, DOCS_DIR)
  await copyDirectory(dir, `${base}/${SNIPPETS_DIR}`, SNIPPETS_DIR)
  if (await directoryExists(dir, `${base}/${TEMPLATES_DIR}`)) {
    await clearDirectory(dir, TEMPLATES_DIR)
    await copyDirectory(dir, `${base}/${TEMPLATES_DIR}`, TEMPLATES_DIR)
  }
  if (await directoryExists(dir, `${base}/${PUBLICATIONS_DIR}`)) {
    await clearDirectory(dir, PUBLICATIONS_DIR)
    await copyDirectory(dir, `${base}/${PUBLICATIONS_DIR}`, PUBLICATIONS_DIR)
  }
  if (await pathExists(dir, `${base}/${VARIABLES_FILE}`)) await copyFile(dir, `${base}/${VARIABLES_FILE}`, VARIABLES_FILE)
  if (await pathExists(dir, `${base}/${CONDITIONS_FILE}`)) await copyFile(dir, `${base}/${CONDITIONS_FILE}`, CONDITIONS_FILE)

  return safetyName
}

/** Fails soft to an empty log — a missing or malformed publish-log.json never blocks publishing. */
export async function readPublishLog(dir: FileSystemDirectoryHandle): Promise<PublishLogEntry[]> {
  try {
    const raw = await readTextFile(dir, PUBLISH_LOG_FILE)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PublishLogEntry[]) : []
  } catch {
    return []
  }
}

export async function appendPublishLogEntry(dir: FileSystemDirectoryHandle, entry: PublishLogEntry): Promise<void> {
  const log = await readPublishLog(dir)
  log.push(entry)
  await writeTextFile(dir, PUBLISH_LOG_FILE, `${JSON.stringify(log, null, 2)}\n`)
}
