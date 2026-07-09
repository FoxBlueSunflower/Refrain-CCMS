import { WORKSPACE_FILE } from '../core/workspace/constants'
import { buildSampleWorkspaceFiles } from '../core/workspace/sample-workspace'
import type { WorkspaceConfig } from '../core/workspace/types'
import { validateWorkspaceConfig, type ValidationResult } from '../core/workspace/validate'
import { readTextFile, writeTextFile } from './directory'

export async function looksLikeWorkspace(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dir.getFileHandle(WORKSPACE_FILE)
    return true
  } catch {
    return false
  }
}

export async function readWorkspaceConfig(dir: FileSystemDirectoryHandle): Promise<ValidationResult<WorkspaceConfig>> {
  try {
    const raw = await readTextFile(dir, WORKSPACE_FILE)
    return validateWorkspaceConfig(JSON.parse(raw))
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] }
  }
}

export async function createSampleWorkspace(dir: FileSystemDirectoryHandle): Promise<void> {
  for (const file of buildSampleWorkspaceFiles()) {
    await writeTextFile(dir, file.path, file.contents)
  }
}
