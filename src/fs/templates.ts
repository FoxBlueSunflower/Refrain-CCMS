import type { FrontmatterEntryKind } from '../core/frontmatter/schema'
import { TEMPLATE_ARCHIVED_SUBDIR } from '../core/workspace/constants'
import { defaultFrontmatterFor, isArchivedTemplatePath, templateBaseDir } from '../core/workspace/templates'
import { buildDocTree } from '../core/workspace/tree'
import type { DocTreeNode } from '../core/workspace/types'
import { readTextFile, resolveDirectoryHandle, writeTextFile } from './directory'
import { findUniqueFilePath, moveFile, walkMarkdownTree } from './folders'

export interface TemplateSummary {
  path: string
  title: string
}

function flattenFiles(nodes: DocTreeNode[], out: TemplateSummary[]): void {
  for (const node of nodes) {
    if (node.kind === 'file') {
      out.push({ path: node.path, title: node.name })
    } else if (node.children) {
      flattenFiles(node.children, out)
    }
  }
}

/** Walks a workspace's templates/docs/ or templates/snippets/ folder and builds the management-panel tree. */
export async function readTemplateTree(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
): Promise<DocTreeNode[]> {
  const dirHandle = await resolveDirectoryHandle(rootHandle, templateBaseDir(entryKind), { create: true })
  const { entries, folderMeta, fileOrder } = await walkMarkdownTree(dirHandle)
  return buildDocTree(entries, folderMeta, fileOrder)
}

/** Flattened templates of `entryKind`, archived and active alike — the Templates management panel's data source. */
export async function readAllTemplates(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
): Promise<TemplateSummary[]> {
  const tree = await readTemplateTree(rootHandle, entryKind)
  const all: TemplateSummary[] = []
  flattenFiles(tree, all)
  return all
}

/** Flattened, non-archived templates of `entryKind` — the "New from template" picker's data source. */
export async function readAvailableTemplates(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
): Promise<TemplateSummary[]> {
  const all = await readAllTemplates(rootHandle, entryKind)
  return all.filter((t) => !isArchivedTemplatePath(t.path))
}

export async function readTemplateBody(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
  relPath: string,
): Promise<string> {
  return readTextFile(rootHandle, `${templateBaseDir(entryKind)}/${relPath}`)
}

/** Creates a new blank template with placeholder boilerplate. Returns the new relPath (relative to templateBaseDir). */
export async function createTemplate(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
  title: string,
): Promise<string> {
  const stem = title.trim() || 'untitled'
  const fullPath = await findUniqueFilePath(rootHandle, templateBaseDir(entryKind), '', stem)
  await writeTextFile(rootHandle, fullPath, defaultFrontmatterFor(entryKind, title))
  return fullPath.slice(templateBaseDir(entryKind).length + 1)
}

/** Moves a template into the archived/ subfolder. Returns the new relPath. */
export async function archiveTemplate(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
  relPath: string,
): Promise<string> {
  const baseDir = templateBaseDir(entryKind)
  const newPath = await moveFile(rootHandle, `${baseDir}/${relPath}`, `${baseDir}/${TEMPLATE_ARCHIVED_SUBDIR}`)
  return newPath.slice(baseDir.length + 1)
}

/** Moves a template out of the archived/ subfolder back to the template kind's root. Returns the new relPath. */
export async function unarchiveTemplate(
  rootHandle: FileSystemDirectoryHandle,
  entryKind: FrontmatterEntryKind,
  relPath: string,
): Promise<string> {
  const baseDir = templateBaseDir(entryKind)
  const newPath = await moveFile(rootHandle, `${baseDir}/${relPath}`, baseDir)
  return newPath.slice(baseDir.length + 1)
}
