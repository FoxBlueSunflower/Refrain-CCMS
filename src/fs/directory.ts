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

export async function pathExists(dir: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  const segments = splitPath(path)
  const fileName = segments[segments.length - 1]
  try {
    const parent = await resolveDirectory(dir, segments.slice(0, -1))
    await parent.getFileHandle(fileName)
    return true
  } catch {
    return false
  }
}

export async function directoryExists(dir: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  try {
    await resolveDirectory(dir, splitPath(path))
    return true
  } catch {
    return false
  }
}

/** Resolves a workspace-relative directory path to its handle, optionally creating it (and any missing ancestors). */
export async function resolveDirectoryHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  options?: { create?: boolean },
): Promise<FileSystemDirectoryHandle> {
  return resolveDirectory(root, splitPath(path), options)
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
 * Removes every entry inside the directory at `path` (creating the
 * directory first if it doesn't exist yet), leaving the directory itself in
 * place, empty. Used to give a rebuilt publish/ a clean slate so renamed or
 * deleted documents don't leave orphaned stale pages behind.
 */
export async function clearDirectory(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  const segments = splitPath(path)
  try {
    const target = await resolveDirectory(dir, segments, { create: true })
    for await (const handle of target.values()) {
      await target.removeEntry(handle.name, { recursive: true })
    }
  } catch (error) {
    throw wrapFsError(`Could not clear ${path}`, error)
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

export async function copyFile(dir: FileSystemDirectoryHandle, fromPath: string, toPath: string): Promise<void> {
  const contents = await readTextFile(dir, fromPath)
  await writeTextFile(dir, toPath, contents)
}

async function copyDirectoryContents(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const handle of source.values()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      const contents = await file.text()
      const destFile = await destination.getFileHandle(handle.name, { create: true })
      const writable = await destFile.createWritable()
      await writable.write(contents)
      await writable.close()
    } else {
      const destDir = await destination.getDirectoryHandle(handle.name, { create: true })
      await copyDirectoryContents(handle as FileSystemDirectoryHandle, destDir)
    }
  }
}

/**
 * Recursively copies every file under `fromPath` into `toPath` (both
 * workspace-relative), creating destination directories as needed. `fromPath`
 * is created empty if missing (matching clearDirectory's create-if-missing
 * semantics) rather than throwing. Used to freeze docs/ and snippets/ into a
 * snapshot, and to restore one back out.
 */
export async function copyDirectory(dir: FileSystemDirectoryHandle, fromPath: string, toPath: string): Promise<void> {
  try {
    const source = await resolveDirectory(dir, splitPath(fromPath), { create: true })
    const destination = await resolveDirectory(dir, splitPath(toPath), { create: true })
    await copyDirectoryContents(source, destination)
  } catch (error) {
    throw wrapFsError(`Could not copy ${fromPath} to ${toPath}`, error)
  }
}
