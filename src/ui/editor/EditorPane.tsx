import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { checkHeadingNormalization } from '../../core/frontmatter/headingCheck'
import { parseFrontmatter, type FrontmatterScalar } from '../../core/frontmatter/parse'
import type { FrontmatterEntryKind } from '../../core/frontmatter/schema'
import { deleteFrontmatterField, setFrontmatterField } from '../../core/frontmatter/update'
import { collectInternalLinks } from '../../core/indexer/links'
import { collectRefs } from '../../core/indexer/scan'
import type { WorkspaceIndex } from '../../core/indexer/types'
import type { ResolveContext } from '../../core/resolver/types'
import type { ConditionsFile } from '../../core/workspace/types'
import type { BlockAction } from './blockEditing'
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from './CodeMirrorEditor'
import type { TokenCompletionItems } from './completions'
import { FrontmatterFormPanel } from './FrontmatterFormPanel'
import type { InlineAction } from './inlineEditing'
import { InsertToolbar } from './InsertToolbar'
import { PreviewPane } from './PreviewPane'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface EditorPaneHandle {
  togglePreview: () => void
}

interface EditorPaneProps {
  title: string
  path: string
  entryKind: FrontmatterEntryKind
  /** Only affects the frontmatter panel's initial collapsed/expanded state — see FrontmatterFormPanel. */
  justCreated: boolean
  initialValue: string
  dirty: boolean
  saveStatus: SaveStatus
  currentRelPath: string | null
  resolveContext: ResolveContext
  /** All known document paths, relative to docs/, used by link pills to detect broken internal links. */
  documentPaths: ReadonlySet<string>
  completionItems: TokenCompletionItems
  conditionsFile: ConditionsFile
  index: WorkspaceIndex
  onChange: (text: string) => void
  onSave: () => void
  onNavigate: (relPath: string) => void
  onOpenPublish: () => void
  onOpenProfiles: () => void
  onOpenVariables: () => void
  onOpenConditions: () => void
  onOpenWhereUsed: () => void
}

function statusLabel(dirty: boolean, saveStatus: SaveStatus): { text: string; className: string } {
  if (saveStatus === 'saving') return { text: 'Saving…', className: 'text-gray-400' }
  if (saveStatus === 'error') return { text: 'Save failed', className: 'text-red-400' }
  if (dirty) return { text: 'Unsaved', className: 'text-amber-400' }
  return { text: 'Saved', className: 'text-gray-400' }
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  {
    title,
    path,
    entryKind,
    justCreated,
    initialValue,
    dirty,
    saveStatus,
    currentRelPath,
    resolveContext,
    documentPaths,
    completionItems,
    conditionsFile,
    index,
    onChange,
    onSave,
    onNavigate,
    onOpenPublish,
    onOpenProfiles,
    onOpenVariables,
    onOpenConditions,
    onOpenWhereUsed,
  },
  forwardedRef,
) {
  const status = statusLabel(dirty, saveStatus)
  const editorRef = useRef<CodeMirrorEditorHandle | null>(null)
  const [previewVisible, setPreviewVisible] = useState(true)
  const [frontmatterCollapsed, setFrontmatterCollapsed] = useState(!justCreated)

  // Whole file text (frontmatter + body), owned locally so the frontmatter
  // form and the body-only CodeMirror editor can each edit their own slice
  // and recombine into the single string WorkspaceShell's onChange/autosave
  // pipeline expects. Read once at mount — this component is remounted per
  // open file (key={fullPath} in WorkspaceShell), same lifecycle CodeMirror
  // already relies on for its own "read initialValue once" contract.
  const docTextRef = useRef(initialValue)
  const [docText, setDocText] = useState(initialValue)
  const parsed = useMemo(() => parseFrontmatter(docText), [docText])
  // Heading normalization (Phase 9a) only applies to documents — snippets have
  // no title field and no publication-tree node to label.
  const headingWarnings = useMemo(
    () => (entryKind === 'document' ? checkHeadingNormalization(parsed.body, parsed.frontmatter.title) : []),
    [entryKind, parsed],
  )
  const frontmatterWarnings = useMemo(() => [...parsed.warnings, ...headingWarnings], [parsed, headingWarnings])

  const usesItems = useMemo(() => {
    const refs = collectRefs(docText)
    const links = collectInternalLinks(docText, currentRelPath, documentPaths)
    return {
      variables: [...refs.variables].sort(),
      snippets: [...refs.snippets].sort(),
      links: [...links].sort(),
    }
  }, [docText, currentRelPath, documentPaths])

  const usedInCount =
    entryKind === 'snippet'
      ? (index.snippets[title]?.length ?? 0) + (index.snippetsUsedBySnippets[title]?.length ?? 0)
      : index.documentPublications[path]?.length ?? 0

  useImperativeHandle(forwardedRef, () => ({
    togglePreview: () => setPreviewVisible((visible) => !visible),
  }))

  function commit(next: string) {
    docTextRef.current = next
    setDocText(next)
    onChange(next)
  }

  function handleBodyChange(newBody: string) {
    // Re-derive the split from docTextRef.current (not the render-scoped
    // `parsed` above) so two commits landing back-to-back within the same
    // synchronous call stack — before React has re-rendered — can't compute
    // the new prefix against a stale body length.
    const current = docTextRef.current
    const currentParsed = parseFrontmatter(current)
    const prefix = current.slice(0, current.length - currentParsed.body.length)
    commit(prefix + newBody)
  }

  function handleFrontmatterFieldChange(key: string, value: FrontmatterScalar) {
    commit(setFrontmatterField(docTextRef.current, key, value))
  }

  function handleFrontmatterKeyRename(oldKey: string, newKey: string, value: FrontmatterScalar) {
    const withoutOld = deleteFrontmatterField(docTextRef.current, oldKey)
    commit(setFrontmatterField(withoutOld, newKey, value))
  }

  function handleFrontmatterFieldDelete(key: string) {
    commit(deleteFrontmatterField(docTextRef.current, key))
  }

  function insert(text: string, caretOffset?: number) {
    editorRef.current?.insertAtCursor(text, caretOffset)
  }

  function insertCondition(dimension: string, value: string) {
    editorRef.current?.wrapSelectionWithCondition(dimension, value)
  }

  function insertBlock(action: BlockAction) {
    editorRef.current?.applyBlockAction(action)
  }

  function insertInline(action: InlineAction) {
    editorRef.current?.applyInlineAction(action)
  }

  function insertLink(target: string) {
    editorRef.current?.insertLink(target)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-800">
      <header className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium text-gray-200">{title}</h1>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
            onClick={() => setPreviewVisible((visible) => !visible)}
          >
            {previewVisible ? 'Hide preview' : 'Show preview'}
          </button>
          <button
            type="button"
            className="rounded border border-violet-600 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-900/40"
            onClick={onOpenPublish}
          >
            Publish
          </button>
          <button
            type="button"
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
            onClick={onOpenProfiles}
          >
            Manage profiles
          </button>
          <span className={`text-xs ${status.className}`}>{status.text}</span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className={`flex min-h-0 flex-1 flex-col ${previewVisible ? 'border-r border-gray-700' : ''}`}>
          <FrontmatterFormPanel
            entryKind={entryKind}
            frontmatter={parsed.frontmatter}
            warnings={frontmatterWarnings}
            collapsed={frontmatterCollapsed}
            onToggleCollapsed={() => setFrontmatterCollapsed((collapsed) => !collapsed)}
            onFieldChange={handleFrontmatterFieldChange}
            onKeyRename={handleFrontmatterKeyRename}
            onFieldDelete={handleFrontmatterFieldDelete}
          />
          <InsertToolbar
            completionItems={completionItems}
            conditionsFile={conditionsFile}
            documentPaths={documentPaths}
            usesItems={usesItems}
            usedInCount={usedInCount}
            onInsertText={insert}
            onInsertCondition={insertCondition}
            onInsertBlock={insertBlock}
            onInsertInline={insertInline}
            onInsertLink={insertLink}
            onNavigate={onNavigate}
            onOpenVariables={onOpenVariables}
            onOpenConditions={onOpenConditions}
            onOpenWhereUsed={onOpenWhereUsed}
          />
          <div className="min-h-0 flex-1">
            <CodeMirrorEditor
              ref={editorRef}
              path={path}
              initialValue={parsed.body}
              onChange={handleBodyChange}
              onSave={onSave}
              completionItems={completionItems}
              conditionsFile={conditionsFile}
              resolveContext={resolveContext}
              currentRelPath={currentRelPath}
              documentPaths={documentPaths}
            />
          </div>
        </div>
        {previewVisible && (
          <div className="min-h-0 flex-1">
            <PreviewPane text={docText} currentRelPath={currentRelPath} onNavigate={onNavigate} resolveContext={resolveContext} />
          </div>
        )}
      </div>
    </div>
  )
})
