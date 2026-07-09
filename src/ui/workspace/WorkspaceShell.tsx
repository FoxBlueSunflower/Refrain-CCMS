import { useCallback, useRef, useState } from 'react'
import { slugify, withMdExtension } from '../../core/workspace/paths'
import { deleteEntry, pathExists, readTextFile, renameFile, writeTextFile } from '../../fs'
import { EditorPane, type SaveStatus } from '../editor/EditorPane'
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

interface OpenDocument {
  kind: EntryKind
  relPath: string
  fullPath: string
}

interface ActiveFile {
  fullPath: string
  savedText: string
}

const AUTOSAVE_DELAY_MS = 1200

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

  const [openDoc, setOpenDoc] = useState<OpenDocument | null>(null)
  const [liveText, setLiveText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [openError, setOpenError] = useState<string | null>(null)

  // Updated synchronously (never via a lagging effect) so async timers and
  // handlers always see the latest edited text and active file — this is
  // what makes fast file-switching lossless.
  const bufferRef = useRef('')
  const activeRef = useRef<ActiveFile | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bump = () => setRefreshToken((t) => t + 1)

  const performSave = useCallback(
    async (fullPath: string, text: string) => {
      setSaveStatus('saving')
      try {
        await writeTextFile(handle, fullPath, text)
        if (activeRef.current?.fullPath === fullPath) {
          activeRef.current.savedText = text
          setDirty(bufferRef.current !== text)
        }
        setSaveStatus('saved')
        setOpenError(null)
      } catch (err) {
        setSaveStatus('error')
        setOpenError(`Could not save: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [handle],
  )

  const flushPendingSave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const active = activeRef.current
    if (active && bufferRef.current !== active.savedText) {
      await performSave(active.fullPath, bufferRef.current)
    }
  }, [performSave])

  const openEntry = useCallback(
    async (kind: EntryKind, relPath: string) => {
      const fullPath = `${baseDirFor(kind)}/${relPath}`
      if (activeRef.current?.fullPath === fullPath) return

      await flushPendingSave()
      setOpenError(null)
      try {
        const text = await readTextFile(handle, fullPath)
        bufferRef.current = text
        activeRef.current = { fullPath, savedText: text }
        setOpenDoc({ kind, relPath, fullPath })
        setLiveText(text)
        setDirty(false)
        setSaveStatus('idle')
      } catch (err) {
        activeRef.current = null
        setOpenDoc(null)
        setOpenError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle, flushPendingSave],
  )

  const handleNavigateFromPreview = useCallback(
    async (relPath: string) => {
      const fullPath = `${baseDirFor('document')}/${relPath}`
      if (!(await pathExists(handle, fullPath))) {
        setOpenError(
          `Couldn't open "${titleFromPath(relPath)}" — the linked document doesn't exist. It may have been renamed or deleted.`,
        )
        return
      }
      await openEntry('document', relPath)
    },
    [handle, openEntry],
  )

  const handleBufferChange = useCallback(
    (next: string) => {
      bufferRef.current = next
      setLiveText(next)
      const active = activeRef.current
      const isDirty = active ? next !== active.savedText : false
      setDirty(isDirty)

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      if (isDirty) {
        autosaveTimerRef.current = setTimeout(() => {
          autosaveTimerRef.current = null
          const currentActive = activeRef.current
          if (currentActive && bufferRef.current !== currentActive.savedText) {
            void performSave(currentActive.fullPath, bufferRef.current)
          }
        }, AUTOSAVE_DELAY_MS)
      }
    },
    [performSave],
  )

  const handleExplicitSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const active = activeRef.current
    if (active) void performSave(active.fullPath, bufferRef.current)
  }, [performSave])

  const handleCreate = useCallback(
    async (entryKind: EntryKind, title: string) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const path = await uniquePath(handle, baseDir, slugify(title) || 'untitled')
        await writeTextFile(handle, path, templateFor(entryKind, title))
        setError(null)
        setModal({ kind: 'none' })
        bump()
        void openEntry(entryKind, path.slice(baseDir.length + 1))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle, openEntry],
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
        if (activeRef.current?.fullPath === oldPath) {
          activeRef.current.fullPath = newPath
          setOpenDoc({ kind: entryKind, relPath: segments.join('/'), fullPath: newPath })
        }
        setError(null)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle],
  )

  // TODO(future phase): warn on delete if other docs/snippets link to or embed this file
  const handleDelete = useCallback(
    async (entryKind: EntryKind, relPath: string) => {
      try {
        const fullPath = `${baseDirFor(entryKind)}/${relPath}`
        await deleteEntry(handle, fullPath)
        if (activeRef.current?.fullPath === fullPath) {
          if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current)
            autosaveTimerRef.current = null
          }
          activeRef.current = null
          setOpenDoc(null)
        }
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
        onSelectDocument={(path) => void openEntry('document', path)}
        onRenameDocument={(path) => setModal({ kind: 'rename', entryKind: 'document', path })}
        onDeleteDocument={(path) => setModal({ kind: 'delete', entryKind: 'document', path })}
        onNewSnippet={() => setModal({ kind: 'new', entryKind: 'snippet' })}
        onSelectSnippet={(path) => void openEntry('snippet', path)}
        onRenameSnippet={(path) => setModal({ kind: 'rename', entryKind: 'snippet', path })}
        onDeleteSnippet={(path) => setModal({ kind: 'delete', entryKind: 'snippet', path })}
      />
      {openDoc ? (
        <EditorPane
          key={openDoc.fullPath}
          title={titleFromPath(openDoc.relPath)}
          path={openDoc.fullPath}
          initialValue={bufferRef.current}
          liveText={liveText}
          dirty={dirty}
          saveStatus={saveStatus}
          error={openError}
          currentRelPath={openDoc.kind === 'document' ? openDoc.relPath : null}
          onChange={handleBufferChange}
          onSave={handleExplicitSave}
          onNavigate={(relPath) => void handleNavigateFromPreview(relPath)}
        />
      ) : (
        <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-white text-gray-400">
          <p>Select a document</p>
          {(error ?? openError) && <p className="max-w-md text-center text-sm text-red-600">{error ?? openError}</p>}
        </main>
      )}

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
