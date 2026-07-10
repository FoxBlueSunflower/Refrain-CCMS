import { CONDITIONS_FILE, WORKSPACE_FILE } from '../core/workspace/constants'
import { buildSampleWorkspaceFiles } from '../core/workspace/sample-workspace'
import type { ConditionsFile, WorkspaceConfig } from '../core/workspace/types'
import { validateConditionsFile, validateWorkspaceConfig, type ValidationResult } from '../core/workspace/validate'
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

export async function writeWorkspaceConfig(dir: FileSystemDirectoryHandle, config: WorkspaceConfig): Promise<void> {
  await writeTextFile(dir, WORKSPACE_FILE, `${JSON.stringify(config, null, 2)}\n`)
}

/** Fails soft to an empty table — a missing or malformed conditions.json never blocks publishing. */
export async function readConditionsFile(dir: FileSystemDirectoryHandle): Promise<ConditionsFile> {
  try {
    const raw = await readTextFile(dir, CONDITIONS_FILE)
    const result = validateConditionsFile(JSON.parse(raw))
    return result.ok ? result.value : {}
  } catch {
    return {}
  }
}

export async function writeConditionsFile(dir: FileSystemDirectoryHandle, conditions: ConditionsFile): Promise<void> {
  await writeTextFile(dir, CONDITIONS_FILE, `${JSON.stringify(conditions, null, 2)}\n`)
}

export async function createSampleWorkspace(dir: FileSystemDirectoryHandle): Promise<void> {
  for (const file of buildSampleWorkspaceFiles()) {
    await writeTextFile(dir, file.path, file.contents)
  }
}
