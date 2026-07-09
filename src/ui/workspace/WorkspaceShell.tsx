import { useCallback, useState } from 'react'
import { slugify, withMdExtension } from '../../core/workspace/paths'
import { deleteEntry, pathExists, renameFile, writeTextFile } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { Sidebar } from './Sidebar'

interface WorkspaceShellProps {
  handle: FileSystemDirectoryHandle
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'new-document' }
  | { kind: 'rename'; path: string }
  | { kind: 'delete'; path: string }

function titleFromPath(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

/** Finds a free docs/-relative path for `base`, suffixing -2, -3, ... on collision. */
async function uniqueDocPath(handle: FileSystemDirectoryHandle, base: string): Promise<string> {
  const stem = base.endsWith('.md') ? base.slice(0, -3) : base
  let candidate = `docs/${stem}.md`
  let n = 2
  while (await pathExists(handle, candidate)) {
    candidate = `docs/${stem}-${n}.md`
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
    async (title: string) => {
      try {
        const path = await uniqueDocPath(handle, slugify(title) || 'untitled')
        await writeTextFile(handle, path, `---\ntitle: ${title}\n---\n\n# ${title}\n`)
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
    async (oldDocsPath: string, newTitle: string) => {
      try {
        const segments = oldDocsPath.split('/')
        segments[segments.length - 1] = withMdExtension(slugify(newTitle) || 'untitled')
        const newPath = `docs/${segments.join('/')}`
        const oldPath = `docs/${oldDocsPath}`
        if (newPath !== oldPath && (await pathExists(handle, newPath))) {
          setError(`A document named "${segments[segments.length - 1]}" already exists.`)
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
    async (docsPath: string) => {
      try {
        await deleteEntry(handle, `docs/${docsPath}`)
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
        onNewDocument={() => setModal({ kind: 'new-document' })}
        onRenameDocument={(path) => setModal({ kind: 'rename', path })}
        onDeleteDocument={(path) => setModal({ kind: 'delete', path })}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
        <p>Select a document</p>
        {error && <p className="max-w-md text-center text-sm text-red-600">{error}</p>}
      </main>

      {modal.kind === 'new-document' && (
        <DocumentTitleDialog
          heading="New document"
          submitLabel="Create"
          onSubmit={(title) => void handleCreate(title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'rename' && (
        <DocumentTitleDialog
          heading="Rename document"
          submitLabel="Rename"
          initialValue={titleFromPath(modal.path)}
          onSubmit={(title) => void handleRename(modal.path, title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'delete' && (
        <ConfirmDialog
          title="Delete document"
          message={`Delete "${titleFromPath(modal.path)}"? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDelete(modal.path)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}
    </div>
  )
}
