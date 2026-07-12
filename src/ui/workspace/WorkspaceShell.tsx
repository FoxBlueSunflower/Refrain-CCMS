import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildSite } from '../../core/builder/site'
import { parseFrontmatter } from '../../core/frontmatter/parse'
import { buildWorkspaceIndex } from '../../core/indexer/build'
import type { WorkspaceIndex } from '../../core/indexer/types'
import type { Publication } from '../../core/publications/types'
import type { SnippetSource } from '../../core/resolver/types'
import { renderChangelog } from '../../core/snapshots/changelog'
import { diffSnapshotFiles } from '../../core/snapshots/diff'
import { diffConditions, diffVariables } from '../../core/snapshots/discrepancy'
import type { ConditionDiscrepancy, PublishLogEntry, VariableDiscrepancy } from '../../core/snapshots/types'
import { APP_DIR, PUBLISH_DIR } from '../../core/workspace/constants'
import { slugify, withMdExtension } from '../../core/workspace/paths'
import { defaultFrontmatterFor, seedTemplateContent, templateBaseDir } from '../../core/workspace/templates'
import type { ConditionsFile, VariablesFile, WorkspaceConfig } from '../../core/workspace/types'
import {
  appendPublishLogEntry,
  archiveTemplate,
  clearDirectory,
  createFolder,
  createPublication,
  createTemplate,
  deleteEntry,
  deleteFolder,
  deletePublication,
  findUniqueFilePath,
  findUniqueFolderPath,
  listSnapshots,
  moveFile,
  moveFolder,
  pathExists,
  readAllDocuments,
  readAllPublications,
  readAllSnippets,
  readAllTemplates,
  readAvailableTemplates,
  readConditionsFile,
  readCurrentSnapshotFiles,
  readDocTree,
  readPublication,
  readPublishLog,
  readSnapshotFiles,
  readTemplateBody,
  readTextFile,
  readVariablesFile,
  readWorkspaceConfig,
  renameFile,
  renameFolder,
  restoreSnapshot,
  snippetStemExists,
  unarchiveTemplate,
  writeSiblingOrder,
  writeSnapshot,
  writeTextFile,
  type PublicationSummary,
  type SnapshotSummary,
  type TemplateSummary,
} from '../../fs'
import { EditorPane, type EditorPaneHandle, type SaveStatus } from '../editor/EditorPane'
import type { CompletionItem } from '../editor/completions'
import { useToasts } from '../notifications/ToastContext'
import { OnboardingController, type OnboardingControllerHandle } from '../onboarding/OnboardingController'
import { EmptyState } from '../shared/EmptyState'
import { ShortcutsHelpDialog } from '../shortcuts/ShortcutsHelpDialog'
import { useAppShortcuts } from '../shortcuts/useAppShortcuts'
import { ConditionsEditor, type ConditionsEditorHandle } from './ConditionsEditor'
import { ConfirmDialog } from './ConfirmDialog'
import { HistoryPanel } from './HistoryPanel'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { ProfilesEditor, type ProfilesEditorHandle } from './ProfilesEditor'
import { PublicationsPanel } from './PublicationsPanel'
import { PublishPanel, type PublishResultSummary } from './PublishPanel'
import { Sidebar, type SiblingEntry } from './Sidebar'
import { TemplatesPanel } from './TemplatesPanel'
import { VariablesEditor, type VariablesEditorHandle } from './VariablesEditor'
import { WhereUsedPanel } from './WhereUsedPanel'

const CHANGELOG_FILE = 'CHANGELOG.md'

interface WorkspaceShellProps {
  handle: FileSystemDirectoryHandle
  justCreatedSample?: boolean
}

type EntryKind = 'document' | 'snippet'

type Pane = 'document' | 'variables' | 'conditions' | 'profiles'

type ModalState =
  | { kind: 'none' }
  | { kind: 'new'; entryKind: EntryKind }
  | { kind: 'rename'; entryKind: EntryKind; path: string }
  | { kind: 'delete'; entryKind: EntryKind; path: string }
  | { kind: 'new-folder'; entryKind: EntryKind }
  | { kind: 'rename-folder'; entryKind: EntryKind; path: string; currentTitle: string }
  | { kind: 'delete-folder'; entryKind: EntryKind; path: string }

interface OpenDocument {
  kind: EntryKind
  relPath: string
  fullPath: string
  /** True only for the specific openEntry call made right after "New Document"/"New Snippet" — drives the frontmatter panel's default expanded state for that open. Resets to false on any later re-open of the same file (e.g. switching away and back), by design — see BUILD_PLAN.md Phase 8a. */
  justCreated: boolean
  /** True when this open is a template (via the Templates panel) rather than a real doc/snippet — excludes it from the doc-link graph, same treatment snippets already get. */
  isTemplate?: boolean
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

function titleFromPath(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

function parentFolderOf(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

export function WorkspaceShell({ handle, justCreatedSample = false }: WorkspaceShellProps) {
  const { push: pushToast } = useToasts()
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [refreshToken, setRefreshToken] = useState(0)
  // Which folder new-document/new-snippet lands in, per entry kind — kept in
  // sync with whichever document/snippet/folder the user last clicked.
  const [currentFolder, setCurrentFolder] = useState<Record<EntryKind, string>>({ document: '', snippet: '' })
  const [availableTemplates, setAvailableTemplates] = useState<TemplateSummary[]>([])

  const [openDoc, setOpenDoc] = useState<OpenDocument | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const [variables, setVariables] = useState<VariablesFile>({})
  const [snippets, setSnippets] = useState<SnippetSource>({})
  const [documentPaths, setDocumentPaths] = useState<ReadonlySet<string>>(new Set())
  const [index, setIndex] = useState<WorkspaceIndex>({ builtAt: '', snippets: {}, variables: {}, conditions: {} })
  const [whereUsedOpen, setWhereUsedOpen] = useState(false)

  const [conditionsFile, setConditionsFile] = useState<ConditionsFile>({})

  const [publishOpen, setPublishOpen] = useState(false)
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResultSummary | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [publishLog, setPublishLog] = useState<PublishLogEntry[]>([])
  const [snapshotting, setSnapshotting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreDiscrepancies, setRestoreDiscrepancies] = useState<{
    variables: VariableDiscrepancy[]
    conditions: ConditionDiscrepancy[]
  } | null>(null)

  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [docTemplates, setDocTemplates] = useState<TemplateSummary[]>([])
  const [snippetTemplates, setSnippetTemplates] = useState<TemplateSummary[]>([])

  const [publicationsOpen, setPublicationsOpen] = useState(false)
  const [publications, setPublications] = useState<PublicationSummary[]>([])
  const [selectedPublicationPath, setSelectedPublicationPath] = useState<string | null>(null)
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null)
  const [creatingPublication, setCreatingPublication] = useState(false)
  const [deletingPublicationPaths, setDeletingPublicationPaths] = useState<ReadonlySet<string>>(new Set())
  const publicationSelectionRef = useRef(0)

  const [activePane, setActivePane] = useState<Pane>('document')
  const [openedPanes, setOpenedPanes] = useState<Set<Exclude<Pane, 'document'>>>(new Set())
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)
  const variablesEditorRef = useRef<VariablesEditorHandle | null>(null)
  const conditionsEditorRef = useRef<ConditionsEditorHandle | null>(null)
  const profilesEditorRef = useRef<ProfilesEditorHandle | null>(null)
  const editorPaneRef = useRef<EditorPaneHandle | null>(null)
  const onboardingRef = useRef<OnboardingControllerHandle | null>(null)

  // Updated synchronously (never via a lagging effect) so async timers and
  // handlers always see the latest edited text and active file — this is
  // what makes fast file-switching lossless.
  const bufferRef = useRef('')
  const activeRef = useRef<ActiveFile | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bump = () => setRefreshToken((t) => t + 1)

  const reloadResolverData = useCallback(async () => {
    const [nextVariables, nextSnippets, nextDocuments, nextConditionsFile, workspaceConfigResult] = await Promise.all([
      readVariablesFile(handle),
      readAllSnippets(handle),
      readAllDocuments(handle),
      readConditionsFile(handle),
      readWorkspaceConfig(handle),
    ])
    setVariables(nextVariables)
    setSnippets(nextSnippets)
    setDocumentPaths(new Set(nextDocuments.map((d) => d.path.slice(baseDirFor('document').length + 1))))
    setConditionsFile(nextConditionsFile)
    setWorkspaceConfig(workspaceConfigResult.ok ? workspaceConfigResult.value : null)

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

  useEffect(() => {
    if (modal.kind !== 'new') {
      setAvailableTemplates([])
      return
    }
    let cancelled = false
    void readAvailableTemplates(handle, modal.entryKind).then((templates) => {
      if (!cancelled) setAvailableTemplates(templates)
    })
    return () => {
      cancelled = true
    }
  }, [handle, modal])

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
        void reloadResolverData()
      } catch (err) {
        setSaveStatus('error')
        pushToast({ kind: 'error', message: `Could not save: ${err instanceof Error ? err.message : String(err)}` })
      }
    },
    [handle, reloadResolverData, pushToast],
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

  // Flushes the document editor plus every side-pane's pending autosave —
  // called before switching to any pane (including the one already active,
  // which is a safe no-op per attemptSave's own dirty check).
  const flushAllPanes = useCallback(async () => {
    await Promise.all([
      flushPendingSave(),
      variablesEditorRef.current?.flushSave() ?? Promise.resolve(),
      conditionsEditorRef.current?.flushSave() ?? Promise.resolve(),
      profilesEditorRef.current?.flushSave() ?? Promise.resolve(),
    ])
  }, [flushPendingSave])

  const openEntry = useCallback(
    async (kind: EntryKind, relPath: string, justCreated = false) => {
      const fullPath = `${baseDirFor(kind)}/${relPath}`
      if (activeRef.current?.fullPath === fullPath && activePane === 'document') return

      await flushAllPanes()
      setActivePane('document')
      try {
        const text = await readTextFile(handle, fullPath)
        bufferRef.current = text
        activeRef.current = { fullPath, savedText: text }
        setOpenDoc({ kind, relPath, fullPath, justCreated })
        setDirty(false)
        setSaveStatus('idle')
      } catch (err) {
        activeRef.current = null
        setOpenDoc(null)
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, flushAllPanes, activePane, pushToast],
  )

  /** Opens a template into the same editor slot as a real doc/snippet, via templates/docs/ or templates/snippets/ instead of docs/ or snippets/. */
  const openTemplateEntry = useCallback(
    async (kind: EntryKind, relPath: string) => {
      const fullPath = `${templateBaseDir(kind)}/${relPath}`
      setTemplatesOpen(false)
      if (activeRef.current?.fullPath === fullPath && activePane === 'document') return

      await flushAllPanes()
      setActivePane('document')
      try {
        const text = await readTextFile(handle, fullPath)
        bufferRef.current = text
        activeRef.current = { fullPath, savedText: text }
        setOpenDoc({ kind, relPath, fullPath, justCreated: false, isTemplate: true })
        setDirty(false)
        setSaveStatus('idle')
      } catch (err) {
        activeRef.current = null
        setOpenDoc(null)
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, flushAllPanes, activePane, pushToast],
  )

  const openVariablesEditor = useCallback(async () => {
    await flushAllPanes()
    setOpenedPanes((prev) => new Set(prev).add('variables'))
    setActivePane('variables')
  }, [flushAllPanes])

  const openConditionsEditor = useCallback(async () => {
    await flushAllPanes()
    setOpenedPanes((prev) => new Set(prev).add('conditions'))
    setActivePane('conditions')
  }, [flushAllPanes])

  const openProfilesEditor = useCallback(async () => {
    await flushAllPanes()
    setOpenedPanes((prev) => new Set(prev).add('profiles'))
    setActivePane('profiles')
  }, [flushAllPanes])

  const openPublishPanel = useCallback(() => {
    setPublishOpen(true)
  }, [])

  const handlePublish = useCallback(
    async (profileName: string) => {
      if (!workspaceConfig) return
      const profile = workspaceConfig.publishProfiles[profileName]
      if (!profile) return

      setPublishing(true)
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

        // Diff against the previous publish's snapshot BEFORE writing the new one.
        const log = await readPublishLog(handle)
        const previousEntry = log[log.length - 1]
        const previousFiles = previousEntry ? await readSnapshotFiles(handle, previousEntry.snapshot) : []
        const currentFiles = await readCurrentSnapshotFiles(handle)
        const changes = diffSnapshotFiles(previousFiles, currentFiles)
        const snapshotName = await writeSnapshot(handle, 'publish')
        const entry: PublishLogEntry = { at: new Date().toISOString(), profile: profileName, snapshot: snapshotName, changes }
        await appendPublishLogEntry(handle, entry)
        await writeTextFile(handle, CHANGELOG_FILE, renderChangelog([...log, entry]))

        setPublishResult({ profileName, warnings: result.warnings, pageCount: result.files.length, changes })
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        setPublishing(false)
      }
    },
    [handle, workspaceConfig, conditionsFile, snippets, variables, pushToast],
  )

  const loadHistory = useCallback(async () => {
    try {
      const [nextSnapshots, nextLog] = await Promise.all([listSnapshots(handle), readPublishLog(handle)])
      setSnapshots(nextSnapshots)
      setPublishLog(nextLog)
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [handle, pushToast])

  const openHistoryPanel = useCallback(() => {
    setHistoryOpen(true)
    void loadHistory()
  }, [loadHistory])

  const loadTemplates = useCallback(async () => {
    try {
      const [docs, snips] = await Promise.all([readAllTemplates(handle, 'document'), readAllTemplates(handle, 'snippet')])
      setDocTemplates(docs)
      setSnippetTemplates(snips)
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [handle, pushToast])

  const openTemplatesPanel = useCallback(() => {
    setTemplatesOpen(true)
    void loadTemplates()
  }, [loadTemplates])

  const handleCreateTemplate = useCallback(
    async (entryKind: EntryKind, title: string) => {
      try {
        await createTemplate(handle, entryKind, title)
        await loadTemplates()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, loadTemplates, pushToast],
  )

  const handleArchiveTemplate = useCallback(
    async (entryKind: EntryKind, relPath: string) => {
      try {
        await archiveTemplate(handle, entryKind, relPath)
        await loadTemplates()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, loadTemplates, pushToast],
  )

  const handleUnarchiveTemplate = useCallback(
    async (entryKind: EntryKind, relPath: string) => {
      try {
        await unarchiveTemplate(handle, entryKind, relPath)
        await loadTemplates()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, loadTemplates, pushToast],
  )

  const loadPublications = useCallback(async () => {
    try {
      setPublications(await readAllPublications(handle))
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [handle, pushToast])

  const openPublicationsPanel = useCallback(() => {
    setPublicationsOpen(true)
    void loadPublications()
  }, [loadPublications])

  const handleSelectPublication = useCallback(
    async (path: string) => {
      setSelectedPublicationPath(path)
      const token = ++publicationSelectionRef.current
      const result = await readPublication(handle, path)
      if (publicationSelectionRef.current !== token) return // a newer selection is already in flight
      if (result.ok) {
        setSelectedPublication(result.value)
      } else {
        setSelectedPublicationPath(null)
        setSelectedPublication(null)
        pushToast({ kind: 'error', message: `Couldn't read that publication: ${result.errors.join(', ')}` })
      }
    },
    [handle, pushToast],
  )

  const handleCreatePublication = useCallback(
    async (title: string): Promise<boolean> => {
      if (creatingPublication) return false
      setCreatingPublication(true)
      try {
        const { path, publication } = await createPublication(handle, title)
        setPublications((prev) =>
          [...prev, { path, title: publication.title, nodeCount: 0 }].sort((a, b) => a.title.localeCompare(b.title)),
        )
        publicationSelectionRef.current += 1 // invalidate any read still in flight for the previous selection
        setSelectedPublicationPath(path)
        setSelectedPublication(publication)
        return true
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
        return false
      } finally {
        setCreatingPublication(false)
      }
    },
    [handle, creatingPublication, pushToast],
  )

  const handleDeletePublication = useCallback(
    async (path: string) => {
      if (deletingPublicationPaths.has(path)) return
      setDeletingPublicationPaths((prev) => new Set(prev).add(path))
      try {
        await deletePublication(handle, path)
        if (selectedPublicationPath === path) {
          setSelectedPublicationPath(null)
          setSelectedPublication(null)
        }
        await loadPublications()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        setDeletingPublicationPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    },
    [handle, loadPublications, pushToast, selectedPublicationPath, deletingPublicationPaths],
  )

  const handleSaveNow = useCallback(async () => {
    setSnapshotting(true)
    try {
      await writeSnapshot(handle, 'manual')
      await loadHistory()
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setSnapshotting(false)
    }
  }, [handle, loadHistory, pushToast])

  const handleRestore = useCallback(
    async (snapshotName: string) => {
      setRestoring(true)
      const beforeVariables = variables
      const beforeConditions = conditionsFile
      try {
        await restoreSnapshot(handle, snapshotName)

        // Files on disk just changed out from under the editor — same
        // stale-state clearing handleDelete does for a deleted file.
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current)
          autosaveTimerRef.current = null
        }
        activeRef.current = null
        setOpenDoc(null)

        bump()
        await loadHistory()

        const [afterVariables, afterConditions] = await Promise.all([
          readVariablesFile(handle),
          readConditionsFile(handle),
        ])
        setRestoreDiscrepancies({
          variables: diffVariables(beforeVariables, afterVariables),
          conditions: diffConditions(beforeConditions, afterConditions),
        })
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        setRestoring(false)
      }
    },
    [handle, variables, conditionsFile, loadHistory, pushToast],
  )

  const handleNavigateFromPreview = useCallback(
    async (relPath: string) => {
      const fullPath = `${baseDirFor('document')}/${relPath}`
      if (!(await pathExists(handle, fullPath))) {
        pushToast({
          kind: 'error',
          message: `Couldn't open "${titleFromPath(relPath)}" — the linked document doesn't exist. It may have been renamed or deleted.`,
        })
        return
      }
      await openEntry('document', relPath)
    },
    [handle, openEntry, pushToast],
  )

  const handleBufferChange = useCallback(
    (next: string) => {
      bufferRef.current = next
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
    async (entryKind: EntryKind, title: string, templatePath: string | null = null) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const stem = slugify(title) || 'untitled'
        if (entryKind === 'snippet' && (await snippetStemExists(handle, stem))) {
          pushToast({ kind: 'error', message: `A snippet named "${stem}" already exists.` })
          return
        }
        const path = await findUniqueFilePath(handle, baseDir, currentFolder[entryKind], stem)
        const content =
          templatePath !== null
            ? seedTemplateContent(entryKind, await readTemplateBody(handle, entryKind, templatePath), title)
            : defaultFrontmatterFor(entryKind, title)
        await writeTextFile(handle, path, content)
        setModal({ kind: 'none' })
        bump()
        void openEntry(entryKind, path.slice(baseDir.length + 1), true)
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, openEntry, pushToast, currentFolder],
  )

  const handleRename = useCallback(
    async (entryKind: EntryKind, oldRelPath: string, newTitle: string) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const segments = oldRelPath.split('/')
        const newStem = slugify(newTitle) || 'untitled'
        segments[segments.length - 1] = withMdExtension(newStem)
        const newPath = `${baseDir}/${segments.join('/')}`
        const oldPath = `${baseDir}/${oldRelPath}`

        if (newPath !== oldPath) {
          if (entryKind === 'snippet') {
            if (await snippetStemExists(handle, newStem, oldPath)) {
              pushToast({ kind: 'error', message: `A snippet named "${newStem}" already exists.` })
              return
            }
          } else if (await pathExists(handle, newPath)) {
            pushToast({
              kind: 'error',
              message: `A ${labelFor(entryKind)} named "${segments[segments.length - 1]}" already exists.`,
            })
            return
          }
        }

        await renameFile(handle, oldPath, newPath)
        if (activeRef.current?.fullPath === oldPath) {
          activeRef.current.fullPath = newPath
          setOpenDoc({ kind: entryKind, relPath: segments.join('/'), fullPath: newPath, justCreated: false })
        }
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast],
  )

  const handleCreateFolder = useCallback(
    async (entryKind: EntryKind, title: string) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const slug = slugify(title) || 'untitled'
        const path = await findUniqueFolderPath(handle, baseDir, currentFolder[entryKind], slug)
        await createFolder(handle, path)
        await renameFolder(handle, path, title)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast, currentFolder],
  )

  const handleRenameFolder = useCallback(
    async (entryKind: EntryKind, path: string, newTitle: string) => {
      try {
        await renameFolder(handle, `${baseDirFor(entryKind)}/${path}`, newTitle)
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast],
  )

  const handleDeleteFolder = useCallback(
    async (entryKind: EntryKind, path: string) => {
      try {
        await deleteFolder(handle, `${baseDirFor(entryKind)}/${path}`)
        setCurrentFolder((prev) => (prev[entryKind] === path ? { ...prev, [entryKind]: '' } : prev))
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast],
  )

  const handleSelectFolder = useCallback((entryKind: EntryKind, path: string) => {
    setCurrentFolder((prev) => ({ ...prev, [entryKind]: path }))
  }, [])

  const handleDropEntry = useCallback(
    async (
      entryKind: EntryKind,
      sourcePath: string,
      sourceKind: 'file' | 'folder',
      targetParentPath: string,
      orderedEntries?: SiblingEntry[],
    ) => {
      try {
        const baseDir = baseDirFor(entryKind)
        const sourceFullPath = `${baseDir}/${sourcePath}`
        const targetFullParent = targetParentPath ? `${baseDir}/${targetParentPath}` : baseDir
        const currentParent = parentFolderOf(sourcePath)

        let newFullPath = sourceFullPath
        if (targetParentPath !== currentParent) {
          newFullPath =
            sourceKind === 'folder'
              ? await moveFolder(handle, sourceFullPath, targetFullParent)
              : await moveFile(handle, sourceFullPath, targetFullParent)
        }

        if (orderedEntries) {
          const finalEntries = orderedEntries.map((entry) =>
            entry.path === sourcePath
              ? { path: newFullPath, kind: sourceKind }
              : { path: `${baseDir}/${entry.path}`, kind: entry.kind },
          )
          await writeSiblingOrder(handle, finalEntries)
        }

        if (activeRef.current?.fullPath === sourceFullPath && newFullPath !== sourceFullPath) {
          const newRelPath = newFullPath.slice(baseDir.length + 1)
          activeRef.current.fullPath = newFullPath
          setOpenDoc({ kind: entryKind, relPath: newRelPath, fullPath: newFullPath, justCreated: false })
        }
        setCurrentFolder((prev) => (prev[entryKind] === sourcePath ? { ...prev, [entryKind]: targetParentPath } : prev))
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast],
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
        setModal({ kind: 'none' })
        bump()
      } catch (err) {
        pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [handle, pushToast],
  )

  const closeTopmostOverlay = useCallback(() => {
    if (modal.kind !== 'none') {
      setModal({ kind: 'none' })
    } else if (shortcutsHelpOpen) {
      setShortcutsHelpOpen(false)
    } else if (whereUsedOpen) {
      setWhereUsedOpen(false)
    } else if (publishOpen) {
      setPublishOpen(false)
    } else if (historyOpen) {
      setHistoryOpen(false)
      setRestoreDiscrepancies(null)
    } else if (templatesOpen) {
      setTemplatesOpen(false)
    } else if (publicationsOpen) {
      setPublicationsOpen(false)
    }
  }, [modal, shortcutsHelpOpen, whereUsedOpen, publishOpen, historyOpen, templatesOpen, publicationsOpen])

  const anyOverlayOpen =
    modal.kind !== 'none' ||
    shortcutsHelpOpen ||
    whereUsedOpen ||
    publishOpen ||
    historyOpen ||
    templatesOpen ||
    publicationsOpen

  useAppShortcuts(anyOverlayOpen, {
    onSave: handleExplicitSave,
    onNewDocument: () => setModal({ kind: 'new', entryKind: 'document' }),
    onPublish: openPublishPanel,
    onHistory: openHistoryPanel,
    onWhereUsed: () => setWhereUsedOpen(true),
    onTogglePreview: () => editorPaneRef.current?.togglePreview(),
    onClose: closeTopmostOverlay,
    onHelp: () => setShortcutsHelpOpen(true),
  })

  const documentEditorOpen = activePane === 'document' && !!openDoc

  return (
    <div className="flex h-screen overflow-hidden">
      <OnboardingController ref={onboardingRef} showTourOnMount={justCreatedSample} />
      <Sidebar
        handle={handle}
        refreshToken={refreshToken}
        documentEditorOpen={documentEditorOpen}
        onOpenWhereUsed={() => setWhereUsedOpen(true)}
        onOpenPublish={openPublishPanel}
        onOpenHistory={openHistoryPanel}
        onOpenTemplates={openTemplatesPanel}
        onOpenPublications={openPublicationsPanel}
        onOpenTour={() => onboardingRef.current?.replay()}
        onNewDocument={() => setModal({ kind: 'new', entryKind: 'document' })}
        onNewDocumentFolder={() => setModal({ kind: 'new-folder', entryKind: 'document' })}
        onSelectDocument={(path) => {
          handleSelectFolder('document', parentFolderOf(path))
          void openEntry('document', path)
        }}
        onRenameDocument={(path) => setModal({ kind: 'rename', entryKind: 'document', path })}
        onDeleteDocument={(path) => setModal({ kind: 'delete', entryKind: 'document', path })}
        onSelectDocumentFolder={(path) => handleSelectFolder('document', path)}
        onRenameDocumentFolder={(path, currentTitle) =>
          setModal({ kind: 'rename-folder', entryKind: 'document', path, currentTitle })
        }
        onDeleteDocumentFolder={(path) => setModal({ kind: 'delete-folder', entryKind: 'document', path })}
        onDropDocumentEntry={(sourcePath, sourceKind, targetParentPath, orderedEntries) =>
          void handleDropEntry('document', sourcePath, sourceKind, targetParentPath, orderedEntries)
        }
        onNewSnippet={() => setModal({ kind: 'new', entryKind: 'snippet' })}
        onNewSnippetFolder={() => setModal({ kind: 'new-folder', entryKind: 'snippet' })}
        onSelectSnippet={(path) => {
          handleSelectFolder('snippet', parentFolderOf(path))
          void openEntry('snippet', path)
        }}
        onRenameSnippet={(path) => setModal({ kind: 'rename', entryKind: 'snippet', path })}
        onDeleteSnippet={(path) => setModal({ kind: 'delete', entryKind: 'snippet', path })}
        onSelectSnippetFolder={(path) => handleSelectFolder('snippet', path)}
        onRenameSnippetFolder={(path, currentTitle) =>
          setModal({ kind: 'rename-folder', entryKind: 'snippet', path, currentTitle })
        }
        onDeleteSnippetFolder={(path) => setModal({ kind: 'delete-folder', entryKind: 'snippet', path })}
        onDropSnippetEntry={(sourcePath, sourceKind, targetParentPath, orderedEntries) =>
          void handleDropEntry('snippet', sourcePath, sourceKind, targetParentPath, orderedEntries)
        }
        onOpenVariables={() => void openVariablesEditor()}
        onOpenConditions={() => void openConditionsEditor()}
        onOpenProfiles={() => void openProfilesEditor()}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {openedPanes.has('variables') && (
          <div className={activePane === 'variables' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <VariablesEditor
              ref={variablesEditorRef}
              handle={handle}
              initialVariables={variables}
              onSaved={reloadResolverData}
            />
          </div>
        )}
        {openedPanes.has('conditions') && (
          <div className={activePane === 'conditions' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <ConditionsEditor
              ref={conditionsEditorRef}
              handle={handle}
              initialConditions={conditionsFile}
              onSaved={reloadResolverData}
            />
          </div>
        )}
        {openedPanes.has('profiles') && (
          <div className={activePane === 'profiles' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            {workspaceConfig ? (
              <ProfilesEditor
                ref={profilesEditorRef}
                handle={handle}
                initialProfiles={workspaceConfig.publishProfiles}
                conditionsFile={conditionsFile}
                workspaceConfig={workspaceConfig}
                onSaved={reloadResolverData}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                Couldn't load workspace.json.
              </div>
            )}
          </div>
        )}
        {activePane === 'document' &&
          (openDoc ? (
            <EditorPane
              key={openDoc.fullPath}
              ref={editorPaneRef}
              title={titleFromPath(openDoc.relPath)}
              path={openDoc.fullPath}
              entryKind={openDoc.kind}
              justCreated={openDoc.justCreated}
              initialValue={bufferRef.current}
              dirty={dirty}
              saveStatus={saveStatus}
              currentRelPath={openDoc.kind === 'document' && !openDoc.isTemplate ? openDoc.relPath : null}
              resolveContext={resolveContext}
              documentPaths={documentPaths}
              completionItems={completionItems}
              conditionsFile={conditionsFile}
              onChange={handleBufferChange}
              onSave={handleExplicitSave}
              onNavigate={(relPath) => void handleNavigateFromPreview(relPath)}
              onOpenPublish={openPublishPanel}
              onOpenProfiles={() => void openProfilesEditor()}
              onOpenVariables={() => void openVariablesEditor()}
              onOpenConditions={() => void openConditionsEditor()}
            />
          ) : (
            <main className="flex flex-1 flex-col items-center justify-center bg-gray-900">
              <EmptyState
                title="Select a document"
                description="Pick a document from the sidebar, or create a new one to get started."
                action={{ label: '+ New document', onClick: () => setModal({ kind: 'new', entryKind: 'document' }) }}
              />
            </main>
          ))}
      </div>

      {modal.kind === 'new' && (
        <DocumentTitleDialog
          heading={modal.entryKind === 'document' ? 'New document' : 'New snippet'}
          submitLabel="Create"
          templates={availableTemplates.map((t) => ({ path: t.path, title: t.title }))}
          onSubmit={(title, templatePath) => void handleCreate(modal.entryKind, title, templatePath)}
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

      {modal.kind === 'new-folder' && (
        <DocumentTitleDialog
          heading="New folder"
          submitLabel="Create"
          onSubmit={(title) => void handleCreateFolder(modal.entryKind, title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'rename-folder' && (
        <DocumentTitleDialog
          heading="Rename folder"
          submitLabel="Rename"
          initialValue={modal.currentTitle}
          onSubmit={(title) => void handleRenameFolder(modal.entryKind, modal.path, title)}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'delete-folder' && (
        <ConfirmDialog
          title="Delete folder"
          message={`Delete this empty folder? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDeleteFolder(modal.entryKind, modal.path)}
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
          onPublish={(profileName) => void handlePublish(profileName)}
          onClose={() => setPublishOpen(false)}
        />
      )}

      {historyOpen && (
        <HistoryPanel
          snapshots={snapshots}
          publishLog={publishLog}
          snapshotting={snapshotting}
          restoring={restoring}
          discrepancies={restoreDiscrepancies}
          onSaveNow={() => void handleSaveNow()}
          onRestore={(name) => void handleRestore(name)}
          onClose={() => {
            setHistoryOpen(false)
            setRestoreDiscrepancies(null)
          }}
        />
      )}

      {templatesOpen && (
        <TemplatesPanel
          docTemplates={docTemplates}
          snippetTemplates={snippetTemplates}
          onEdit={(entryKind, relPath) => void openTemplateEntry(entryKind, relPath)}
          onArchive={(entryKind, relPath) => void handleArchiveTemplate(entryKind, relPath)}
          onUnarchive={(entryKind, relPath) => void handleUnarchiveTemplate(entryKind, relPath)}
          onCreate={(entryKind, title) => void handleCreateTemplate(entryKind, title)}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {publicationsOpen && (
        <PublicationsPanel
          publications={publications}
          selectedPath={selectedPublicationPath}
          selectedPublication={selectedPublication}
          creating={creatingPublication}
          deletingPaths={deletingPublicationPaths}
          onSelect={(path) => void handleSelectPublication(path)}
          onCreate={handleCreatePublication}
          onDelete={(path) => void handleDeletePublication(path)}
          onClose={() => setPublicationsOpen(false)}
        />
      )}

      {shortcutsHelpOpen && <ShortcutsHelpDialog onClose={() => setShortcutsHelpOpen(false)} />}
    </div>
  )
}
