import { idbDelete, idbGet, idbSet } from './indexeddb'

const WORKSPACE_HANDLE_KEY = 'workspace-dir-handle'

export class PickerCancelledError extends Error {
  constructor() {
    super('The user cancelled the folder picker')
    this.name = 'PickerCancelledError'
  }
}

/**
 * Opens the native folder picker. Must be called synchronously from a user
 * gesture (e.g. a click handler) — the browser enforces this.
 */
export async function pickWorkspaceFolder(): Promise<FileSystemDirectoryHandle> {
  try {
    return await window.showDirectoryPicker({ id: 'refrain-workspace', mode: 'readwrite' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PickerCancelledError()
    }
    throw error
  }
}

export async function saveWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(WORKSPACE_HANDLE_KEY, handle)
}

export async function getStoredWorkspaceHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return idbGet<FileSystemDirectoryHandle>(WORKSPACE_HANDLE_KEY)
}

export async function clearStoredWorkspaceHandle(): Promise<void> {
  await idbDelete(WORKSPACE_HANDLE_KEY)
}

/** Safe to call on app boot — never prompts and needs no user gesture. */
export async function queryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode,
): Promise<PermissionState> {
  return handle.queryPermission({ mode })
}

/** Must be called from inside a user gesture (e.g. a click handler) — may prompt the user. */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode,
): Promise<PermissionState> {
  return handle.requestPermission({ mode })
}
