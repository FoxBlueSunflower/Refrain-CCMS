import { useRef, useState } from 'react'
import type { ResolveContext } from '../../core/resolver/types'
import type { ConditionsFile } from '../../core/workspace/types'
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from './CodeMirrorEditor'
import type { TokenCompletionItems } from './completions'
import { PreviewPane } from './PreviewPane'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const CONDITION_DIMENSION_LIST = ['audience', 'output'] as const

interface EditorPaneProps {
  title: string
  path: string
  initialValue: string
  liveText: string
  dirty: boolean
  saveStatus: SaveStatus
  error: string | null
  currentRelPath: string | null
  resolveContext: ResolveContext
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

export function EditorPane({
  title,
  path,
  initialValue,
  liveText,
  dirty,
  saveStatus,
  error,
  currentRelPath,
  resolveContext,
  completionItems,
  conditionsFile,
  onChange,
  onSave,
  onNavigate,
}: EditorPaneProps) {
  const status = statusLabel(dirty, saveStatus)
  const editorRef = useRef<CodeMirrorEditorHandle | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  function insert(text: string, caretOffset?: number) {
    editorRef.current?.insertAtCursor(text, caretOffset)
    setPaletteOpen(false)
  }

  function insertCondition(dimension: string, value: string) {
    const opening = `:::when ${dimension}=${value}\n`
    insert(`${opening}\n:::\n`, opening.length)
  }

  const hasItems = completionItems.variables.length > 0 || completionItems.snippets.length > 0
  const hasConditions = CONDITION_DIMENSION_LIST.some((dimension) => conditionsFile[dimension].length > 0)

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
                    {CONDITION_DIMENSION_LIST.flatMap((dimension) =>
                      conditionsFile[dimension].map((value) => (
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
          <span className={`text-xs ${status.className}`}>{status.text}</span>
        </div>
      </header>
      {error && <p className="border-b border-gray-700 px-4 py-2 text-sm text-red-400">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 border-r border-gray-700">
          <CodeMirrorEditor
            ref={editorRef}
            path={path}
            initialValue={initialValue}
            onChange={onChange}
            onSave={onSave}
            completionItems={completionItems}
            conditionsFile={conditionsFile}
          />
        </div>
        <div className="min-h-0 flex-1">
          <PreviewPane text={liveText} currentRelPath={currentRelPath} onNavigate={onNavigate} resolveContext={resolveContext} />
        </div>
      </div>
    </div>
  )
}
