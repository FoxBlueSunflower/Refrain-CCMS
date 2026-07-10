import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildSite } from '../../core/builder/site'
import { parseFrontmatter } from '../../core/frontmatter/parse'
import { buildWorkspaceIndex } from '../../core/indexer/build'
import type { WorkspaceIndex } from '../../core/indexer/types'
import type { SnippetSource } from '../../core/resolver/types'
import { APP_DIR, PUBLISH_DIR } from '../../core/workspace/constants'
import { slugify, withMdExtension } from '../../core/workspace/paths'
import type { ConditionsFile, VariablesFile, WorkspaceConfig } from '../../core/workspace/types'
import {
  clearDirectory,
  deleteEntry,
  pathExists,
  readAllDocuments,
  readAllSnippets,
  readConditionsFile,
  readDocTree,
  readTextFile,
  readVariablesFile,
  readWorkspaceConfig,
  renameFile,
  writeTextFile,
} from '../../fs'
import { EditorPane, type SaveStatus } from '../editor/EditorPane'
import type { CompletionItem } from '../editor/completions'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { PublishPanel, type PublishResultSummary } from './PublishPanel'
import { Sidebar } from './Sidebar'
import { VariablesEditor, type VariablesEditorHandle } from './VariablesEditor'
import { WhereUsedPanel } from './WhereUsedPanel'

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

  const [variables, setVariables] = useState<VariablesFile>({})
  const [snippets, setSnippets] = useState<SnippetSource>({})
  const [index, setIndex] = useState<WorkspaceIndex>({ builtAt: '', snippets: {}, variables: {}, conditions: {} })
  const [whereUsedOpen, setWhereUsedOpen] = useState(false)

  const [publishOpen, setPublishOpen] = useState(false)
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null)
  const [conditionsFile, setConditionsFile] = useState<ConditionsFile | null>(null)
  const [publishConfigLoaded, setPublishConfigLoaded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResultSummary | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const [showVariables, setShowVariables] = useState(false)
  const [variablesOpened, setVariablesOpened] = useState(false)
  const [variablesLoaded, setVariablesLoaded] = useState(false)
  const variablesEditorRef = useRef<VariablesEditorHandle | null>(null)

  // Updated synchronously (never via a lagging effect) so async timers and
  // handlers always see the latest edited text and active file — this is
  // what makes fast file-switching lossless.
  const bufferRef = useRef('')
  const activeRef = useRef<ActiveFile | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bump = () => setRefreshToken((t) => t + 1)

  const reloadResolverData = useCallback(async () => {
    const [nextVariables, nextSnippets, nextDocuments] = await Promise.all([
      readVariablesFile(handle),
      readAllSnippets(handle),
      readAllDocuments(handle),
    ])
    setVariables(nextVariables)
    setSnippets(nextSnippets)
    setVariablesLoaded(true)

    const nextIndex = buildWorkspaceIndex({
      documents: nextDocuments,
      snippets: Object.entries(nextSnippets).map(([name, text]) => ({ name, text })),
    })
    setIndex(nextIndex)
    // .app/index.json is a disposable cache (see SPEC.md) — always rebuilt
    // from the files on disk, never read back, so a missing/deleted file
    // self-heals on the next reload with no special-casing here.
    void writeTextFile(handle, `${APP_DIR}/index.json`, `${JSON.stringify(nextIndex, null, 2)}\n`)
  }, [handle])

  useEffect(() => {
    void reloadResolverData()
  }, [reloadResolverData, refreshToken])

  const resolveContext = useMemo(() => ({ variables, snippets }), [variables, snippets])

  const completionItems = useMemo(() => {
    const variableItems: CompletionItem[] = Object.entries(variables)
      .map(([key, entry]) => ({ key, description: entry.description }))
      .sort((a, b) => a.key.localeCompare(b.key))

    const snippetItems: CompletionItem[] = Object.entries(snippets)
      .map(([key, raw]) => {
        const { frontmatter } = parseFrontmatter(raw)
        return { key, description: typeof frontmatter.description === 'string' ? frontmatter.description : '' }
      })
      .sort((a, b) => a.key.localeCompare(b.key))

    return { variables: variableItems, snippets: snippetItems }
  }, [variables, snippets])

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
        void reloadResolverData()
      } catch (err) {
        setSaveStatus('error')
        setOpenError(`Could not save: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [handle, reloadResolverData],
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
      if (activeRef.current?.fullPath === fullPath && !showVariables) return

      await Promise.all([flushPendingSave(), variablesEditorRef.current?.flushSave() ?? Promise.resolve()])
      setShowVariables(false)
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
    [handle, flushPendingSave, showVariables],
  )

  const openVariablesEditor = useCallback(async () => {
    await flushPendingSave()
    setVariablesOpened(true)
    setShowVariables(true)
  }, [flushPendingSave])

  const openPublishPanel = useCallback(async () => {
    setPublishOpen(true)
    if (!publishConfigLoaded) {
      const [configResult, nextConditionsFile] = await Promise.all([readWorkspaceConfig(handle), readConditionsFile(handle)])
      setWorkspaceConfig(configResult.ok ? configResult.value : null)
      setConditionsFile(nextConditionsFile)
      setPublishConfigLoaded(true)
    }
  }, [handle, publishConfigLoaded])

  const handlePublish = useCallback(
    async (profileName: string) => {
      if (!workspaceConfig || !conditionsFile) return
      const profile = workspaceConfig.publishProfiles[profileName]
      if (!profile) return

      setPublishing(true)
      setPublishError(null)
      try {
        const [docs, docTree] = await Promise.all([readAllDocuments(handle), readDocTree(handle)])
        const result = buildSite({
          documents: docs,
          docTree,
          snippets,
          variables,
          conditionsFile,
          profile,
          siteTitle: workspaceConfig.site.title,
        })
        await clearDirectory(handle, PUBLISH_DIR)
        await Promise.all(result.files.map((file) => writeTextFile(handle, `${PUBLISH_DIR}/${file.path}`, file.contents)))
        setPublishResult({ profileName, warnings: result.warnings, pageCount: result.files.length })
      } catch (err) {
        setPublishError(err instanceof Error ? err.message : String(err))
      } finally {
        setPublishing(false)
      }
    },
    [handle, workspaceConfig, conditionsFile, snippets, variables],
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
        onOpenWhereUsed={() => setWhereUsedOpen(true)}
        onOpenPublish={() => void openPublishPanel()}
        onNewDocument={() => setModal({ kind: 'new', entryKind: 'document' })}
        onSelectDocument={(path) => void openEntry('document', path)}
        onRenameDocument={(path) => setModal({ kind: 'rename', entryKind: 'document', path })}
        onDeleteDocument={(path) => setModal({ kind: 'delete', entryKind: 'document', path })}
        onNewSnippet={() => setModal({ kind: 'new', entryKind: 'snippet' })}
        onSelectSnippet={(path) => void openEntry('snippet', path)}
        onRenameSnippet={(path) => setModal({ kind: 'rename', entryKind: 'snippet', path })}
        onDeleteSnippet={(path) => setModal({ kind: 'delete', entryKind: 'snippet', path })}
        onOpenVariables={() => void openVariablesEditor()}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {variablesOpened && (
          <div className={showVariables ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            {variablesLoaded ? (
              <VariablesEditor
                ref={variablesEditorRef}
                handle={handle}
                initialVariables={variables}
                onSaved={reloadResolverData}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading variables…</div>
            )}
          </div>
        )}
        {!showVariables &&
          (openDoc ? (
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
              resolveContext={resolveContext}
              completionItems={completionItems}
              onChange={handleBufferChange}
              onSave={handleExplicitSave}
              onNavigate={(relPath) => void handleNavigateFromPreview(relPath)}
            />
          ) : (
            <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-gray-900 text-gray-400">
              <p>Select a document</p>
              {(error ?? openError) && <p className="max-w-md text-center text-sm text-red-400">{error ?? openError}</p>}
            </main>
          ))}
      </div>

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

      {whereUsedOpen && (
        <WhereUsedPanel
          variables={variables}
          snippets={snippets}
          index={index}
          onOpenDocument={(docPath) => {
            setWhereUsedOpen(false)
            void openEntry('document', docPath.slice(baseDirFor('document').length + 1))
          }}
          onClose={() => setWhereUsedOpen(false)}
        />
      )}

      {publishOpen && (
        <PublishPanel
          profiles={workspaceConfig?.publishProfiles ?? {}}
          publishing={publishing}
          result={publishResult}
          error={publishError}
          onPublish={(profileName) => void handlePublish(profileName)}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </div>
  )
}
