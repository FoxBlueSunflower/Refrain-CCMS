import { splitPath } from '../core/workspace/paths'

export class FsWriteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FsWriteError'
  }
}

function wrapFsError(message: string, cause: unknown): FsWriteError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new FsWriteError(`${message}: ${detail}`, { cause })
}

export interface DirectoryListEntry {
  name: string
  kind: 'file' | 'directory'
}

export async function listDirectory(dir: FileSystemDirectoryHandle): Promise<DirectoryListEntry[]> {
  const entries: DirectoryListEntry[] = []
  for await (const handle of dir.values()) {
    entries.push({ name: handle.name, kind: handle.kind })
  }
  return entries
}

async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
  options?: { create?: boolean },
): Promise<FileSystemDirectoryHandle> {
  let current = root
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, options)
  }
  return current
}

export async function readTextFile(dir: FileSystemDirectoryHandle, path: string): Promise<string> {
  const segments = splitPath(path)
  const fileName = segments[segments.length - 1]
  try {
    const parent = await resolveDirectory(dir, segments.slice(0, -1))
    const fileHandle = await parent.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    return await file.text()
  } catch (error) {
    throw wrapFsError(`Could not read ${path}`, error)
  }
}

export async function writeTextFile(dir: FileSystemDirectoryHandle, path: string, contents: string): Promise<void> {
  const segments = splitPath(path)
  const fileName = segments[segments.length - 1]
  try {
    const parent = await resolveDirectory(dir, segments.slice(0, -1), { create: true })
    const fileHandle = await parent.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(contents)
    await writable.close()
  } catch (error) {
    throw wrapFsError(`Could not write ${path}`, error)
  }
}

export async function deleteEntry(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  const segments = splitPath(path)
  const name = segments[segments.length - 1]
  try {
    const parent = await resolveDirectory(dir, segments.slice(0, -1))
    await parent.removeEntry(name)
  } catch (error) {
    throw wrapFsError(`Could not delete ${path}`, error)
  }
}

/**
 * The File System Access API has no native rename. Writes the new file
 * first and only deletes the original once that succeeds, so a failure
 * partway through never destroys the original content.
 */
export async function renameFile(dir: FileSystemDirectoryHandle, oldPath: string, newPath: string): Promise<void> {
  const contents = await readTextFile(dir, oldPath)
  await writeTextFile(dir, newPath, contents)
  await deleteEntry(dir, oldPath)
}
