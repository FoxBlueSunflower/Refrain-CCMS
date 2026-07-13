import { strToU8, zipSync } from 'fflate'
import type { BuiltFile } from './types'

/**
 * Packages a Home landing page and the built site's content pages into one
 * zip archive: `homeFile` sits at the archive root, everything else lives
 * under `contentDir` (default "content"). Pure/synchronous — fflate needs
 * no Web Worker or WASM, so this stays a plain src/core module.
 */
export function buildZipArchive(homeFile: BuiltFile, contentFiles: BuiltFile[], contentDir = 'content'): Uint8Array {
  const entries: Record<string, Uint8Array> = { [homeFile.path]: strToU8(homeFile.contents) }
  for (const file of contentFiles) {
    entries[`${contentDir}/${file.path}`] = strToU8(file.contents)
  }
  return zipSync(entries)
}
