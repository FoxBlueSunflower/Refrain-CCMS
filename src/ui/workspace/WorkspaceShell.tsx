import { useCallback, useState } from 'react'
import { slugify, withMdExtension } from '../../core/workspace/paths'
import { deleteEntry, pathExists, renameFile, writeTextFile } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { Sidebar } from './Sidebar'

interface WorkspaceShellProps {
  handle: FileSystemDirectoryHandle
}

type EntryKind = 'document' | 'snippet'

type ModalState =
  | { kind: 'none' }
  | { kind: 'new'; entryKind: EntryKind }
  | { kind: 'rename'; entryKind: EntryKind; path: string }
  | { kind: 'delete'; entryKind: EntryKind; path: string }

function baseDirFor(entryKind: EntryKind): string {
  return entryKind === 'document' ? 'docs' : 'snippets'
}

function labelFor(entryKind: EntryKind): string {
  return entryKind === 'document' ? 'document' : 'snippet'
}

function templateFor(entryKind: EntryKind, title: string): string {
  if (entryKind === 'document') {
    return `---\ntitle: ${title}\n---\n\n# ${title}\n`
  }
  const name = slugify(title) || 'untitled'
  return `---\nname: ${name}\ndescription: ''\nforked_from: null\nforked_from_snapshot: null\n---\n\n`
}

function titleFromPath(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

/** Finds a free path under `baseDir` for `base`, suffixing -2, -3, ... on collision. */
async function uniquePath(handle: FileSystemDirectoryHandle, baseDir: string, base: string): Promise<string> {
  const stem = base.endsWith('.md') ? base.slice(0, -3) : base
  let candidate = `${baseDir}/${stem}.md`
  let n = 2
  while (await pathExists(handle, candidate)) {
    candidate = `${baseDir}/${stem}-${n}.md`
    n += 1
  }
  return candidate
}

export function WorkspaceShell({ handle }: WorkspaceShellProps) {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [refreshToken, setRefreshToken] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const bump = () => setRefreshToken((t) => t + 1)

  const handleCreate = useCallback(
    async (entryKind: EntryKind, title: string) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const path = await uniquePath(handle, baseDir, slugify(title) || 'untitled')
        await writeTextFile(handle, path, templateFor(entryKind, title))
        setError(null)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle],
  )

  const handleRename = useCallback(
    async (entryKind: EntryKind, oldRelPath: string, newTitle: string) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const segments = oldRelPath.split('/')
        segments[segments.length - 1] = withMdExtension(slugify(newTitle) || 'untitled')
        const newPath = `${baseDir}/${segments.join('/')}`
        const oldPath = `${baseDir}/${oldRelPath}`
        if (newPath !== oldPath && (await pathExists(handle, newPath))) {
          setError(`A ${labelFor(entryKind)} named "${segments[segments.length - 1]}" already exists.`)
          return
        }
        await renameFile(handle, oldPath, newPath)
        setError(null)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle],
  )

  const handleDelete = useCallback(
    async (entryKind: EntryKind, relPath: string) => {
      try {
        await deleteEntry(handle, `${baseDirFor(entryKind)}/${relPath}`)
        setError(null)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle],
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar
        handle={handle}
        refreshToken={refreshToken}
        onNewDocument={() => setModal({ kind: 'new', entryKind: 'document' })}
        onRenameDocument={(path) => setModal({ kind: 'rename', entryKind: 'document', path })}
        onDeleteDocument={(path) => setModal({ kind: 'delete', entryKind: 'document', path })}
        onNewSnippet={() => setModal({ kind: 'new', entryKind: 'snippet' })}
        onRenameSnippet={(path) => setModal({ kind: 'rename', entryKind: 'snippet', path })}
        onDeleteSnippet={(path) => setModal({ kind: 'delete', entryKind: 'snippet', path })}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
        <p>Select a document</p>
        {error && <p className="max-w-md text-center text-sm text-red-600">{error}</p>}
      </main>

      {modal.kind === 'new' && (
        <DocumentTitleDialog
          heading={modal.entryKind === 'document' ? 'New document' : 'New snippet'}
          submitLabel="Create"
          onSubmit={(title) => void handleCreate(modal.entryKind, title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'rename' && (
        <DocumentTitleDialog
          heading={modal.entryKind === 'document' ? 'Rename document' : 'Rename snippet'}
          submitLabel="Rename"
          initialValue={titleFromPath(modal.path)}
          onSubmit={(title) => void handleRename(modal.entryKind, modal.path, title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'delete' && (
        <ConfirmDialog
          title={modal.entryKind === 'document' ? 'Delete document' : 'Delete snippet'}
          message={`Delete "${titleFromPath(modal.path)}"? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDelete(modal.entryKind, modal.path)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}
    </div>
  )
}
