import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { parseFrontmatter, type FrontmatterScalar } from '../../core/frontmatter/parse'
import type { FrontmatterEntryKind } from '../../core/frontmatter/schema'
import { deleteFrontmatterField, setFrontmatterField } from '../../core/frontmatter/update'
import type { ResolveContext } from '../../core/resolver/types'
import type { ConditionsFile } from '../../core/workspace/types'
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from './CodeMirrorEditor'
import type { TokenCompletionItems } from './completions'
import { FrontmatterFormPanel } from './FrontmatterFormPanel'
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
  onChange: (text: string) => void
  onSave: () => void
  onNavigate: (relPath: string) => void
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
    onChange,
    onSave,
    onNavigate,
  },
  forwardedRef,
) {
  const status = statusLabel(dirty, saveStatus)
  const editorRef = useRef<CodeMirrorEditorHandle | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
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
    setPaletteOpen(false)
  }

  function insertCondition(dimension: string, value: string) {
    const opening = `:::when ${dimension}=${value}\n`
    insert(`${opening}\n:::\n`, opening.length)
  }

  const hasItems = completionItems.variables.length > 0 || completionItems.snippets.length > 0
  const hasConditions = Object.values(conditionsFile).some((values) => values.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-800">
      <header className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium text-gray-200">{title}</h1>
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative">
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => setPaletteOpen((open) => !open)}
            >
              Insert ▾
            </button>
            {paletteOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPaletteOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-auto rounded border border-gray-600 bg-gray-800 p-2 text-left shadow-lg">
                  {!hasItems && <p className="px-2 py-1 text-xs text-gray-400">No variables or snippets yet.</p>}
                  {completionItems.variables.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Variables</p>
                      {completionItems.variables.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                          title={v.description}
                          onClick={() => insert(`{{${v.key}}}`)}
                        >
                          {`{{${v.key}}}`}
                          {v.description && <span className="ml-2 text-xs text-gray-400">{v.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {completionItems.snippets.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Snippets</p>
                      {completionItems.snippets.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                          title={s.description}
                          onClick={() => insert(`{{> ${s.key}}}`)}
                        >
                          {`{{> ${s.key}}}`}
                          {s.description && <span className="ml-2 text-xs text-gray-400">{s.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Conditions</p>
                    {!hasConditions && <p className="px-2 py-1 text-xs text-gray-400">No condition values yet.</p>}
                    {Object.entries(conditionsFile).flatMap(([dimension, values]) =>
                      values.map((value) => (
                        <button
                          key={`${dimension}=${value}`}
                          type="button"
                          className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                          onClick={() => insertCondition(dimension, value)}
                        >
                          {`:::when ${dimension}=${value}`}
                        </button>
                      )),
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
            onClick={() => setPreviewVisible((visible) => !visible)}
          >
            {previewVisible ? 'Hide preview' : 'Show preview'}
          </button>
          <span className={`text-xs ${status.className}`}>{status.text}</span>
        </div>
      </header>
      <FrontmatterFormPanel
        entryKind={entryKind}
        frontmatter={parsed.frontmatter}
        warnings={parsed.warnings}
        collapsed={frontmatterCollapsed}
        onToggleCollapsed={() => setFrontmatterCollapsed((collapsed) => !collapsed)}
        onFieldChange={handleFrontmatterFieldChange}
        onKeyRename={handleFrontmatterKeyRename}
        onFieldDelete={handleFrontmatterFieldDelete}
      />
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 flex-1 ${previewVisible ? 'border-r border-gray-700' : ''}`}>
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
        {previewVisible && (
          <div className="min-h-0 flex-1">
            <PreviewPane text={docText} currentRelPath={currentRelPath} onNavigate={onNavigate} resolveContext={resolveContext} />
          </div>
        )}
      </div>
    </div>
  )
})
