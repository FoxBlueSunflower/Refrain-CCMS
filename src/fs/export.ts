export class ExportCancelledError extends Error {
  constructor() {
    super('The user cancelled the export save dialog')
    this.name = 'ExportCancelledError'
  }
}

/**
 * Opens the native save-file dialog for an exported zip. Must be called
 * synchronously-ish from a user gesture (e.g. a click handler), same
 * constraint as showDirectoryPicker in src/fs/workspace-handle.ts.
 */
export async function pickZipSaveTarget(suggestedName: string): Promise<FileSystemFileHandle> {
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ExportCancelledError()
    }
    throw error
  }
}

export async function writeFileHandleBytes(handle: FileSystemFileHandle, data: Uint8Array): Promise<void> {
  const writable = await handle.createWritable()
  // fflate's zipSync return type is Uint8Array<ArrayBufferLike>, which the
  // File System Access API's stricter Uint8Array<ArrayBuffer> write type
  // rejects — copy into a fresh, definitely-ArrayBuffer-backed Uint8Array.
  await writable.write(new Uint8Array(data))
  await writable.close()
}

/**
 * Opens the native save-file dialog for an exported markdown file (the
 * "Export as Markdown" action's output). Same user-gesture constraint as
 * pickZipSaveTarget above.
 */
export async function pickMarkdownSaveTarget(suggestedName: string): Promise<FileSystemFileHandle> {
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Markdown file', accept: { 'text/markdown': ['.md'] } }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ExportCancelledError()
    }
    throw error
  }
}

export async function writeFileHandleText(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}
