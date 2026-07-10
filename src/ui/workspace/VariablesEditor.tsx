import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { VariablesFile } from '../../core/workspace/types'
import { validateIdentifierKeys, type IdentifierError, type KeyCandidate } from '../../core/workspace/identifier-keys'
import { writeVariablesFile } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'

const AUTOSAVE_DELAY_MS = 1200

interface DraftRow {
  id: string
  key: string
  value: string
  description: string
  /** True for rows loaded from disk at mount; false for rows added this session and never saved. */
  existedAtLoad: boolean
}

interface VariablesEditorProps {
  handle: FileSystemDirectoryHandle
  /**
   * Read once via a lazy useState initializer — deliberately never resynced
   * from prop changes. WorkspaceShell's reloadResolverData() re-fires after
   * every document/snippet save and would otherwise clobber an in-progress
   * (possibly currently-invalid) draft sitting in this panel while it's
   * hidden behind the document editor. Do not add an effect that resyncs
   * rows from this prop.
   */
  initialVariables: VariablesFile
  onSaved: () => void
}

export interface VariablesEditorHandle {
  /** No-op if the current draft is invalid — nothing safe to write. The
   *  draft stays in memory (this component never unmounts) until fixed. */
  flushSave: () => Promise<void>
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function rowsFromVariablesFile(variables: VariablesFile): DraftRow[] {
  return Object.entries(variables)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => ({
      id: crypto.randomUUID(),
      key,
      value: entry.value,
      description: entry.description,
      existedAtLoad: true,
    }))
}

function serializeRows(rows: DraftRow[]): VariablesFile {
  const result: VariablesFile = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    result[key] = { value: row.value, description: row.description }
  }
  return result
}

/** Order-independent snapshot for dirty-checking — row add/delete/reorder never produces a spurious dirty flag. */
function canonicalJson(variables: VariablesFile): string {
  return JSON.stringify(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)))
}

function errorMessage(errors: IdentifierError[]): string {
  if (errors.includes('empty')) return 'Key is required'
  const invalid = errors.includes('invalid-format')
  const duplicate = errors.includes('duplicate')
  if (invalid && duplicate) return 'Only letters, numbers, _ and - are allowed, and this key is already used by another row'
  if (invalid) return 'Only letters, numbers, _ and - are allowed'
  if (duplicate) return 'This key is already used by another row'
  return ''
}

export const VariablesEditor = forwardRef<VariablesEditorHandle, VariablesEditorProps>(function VariablesEditor(
  { handle, initialVariables, onSaved },
  forwardedRef,
) {
  const [rows, setRows] = useState<DraftRow[]>(() => rowsFromVariablesFile(initialVariables))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const rowsRef = useRef(rows)
  const lastSavedRef = useRef(canonicalJson(initialVariables))
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    },
    [],
  )

  const rowErrors = useMemo(
    () => validateIdentifierKeys(rows.map((row): KeyCandidate => ({ id: row.id, key: row.key }))),
    [rows],
  )
  const hasErrors = rowErrors.size > 0

  const currentJson = useMemo(() => canonicalJson(serializeRows(rows)), [rows])
  const dirty = currentJson !== lastSavedRef.current

  const attemptSave = useCallback(
    async (currentRows: DraftRow[]) => {
      const errors = validateIdentifierKeys(currentRows.map((row): KeyCandidate => ({ id: row.id, key: row.key })))
      if (errors.size > 0) return
      const nextFile = serializeRows(currentRows)
      const nextJson = canonicalJson(nextFile)
      if (nextJson === lastSavedRef.current) return
      setSaveStatus('saving')
      try {
        await writeVariablesFile(handle, nextFile)
        lastSavedRef.current = nextJson
        // Rows just written to disk are no longer "unsaved additions" — mark
        // them so a later delete asks for confirmation instead of silently
        // discarding data that now actually exists in variables.json.
        const savedIds = new Set(currentRows.filter((row) => row.key.trim()).map((row) => row.id))
        setRows((prev) => {
          const next = prev.map((row) => (savedIds.has(row.id) ? { ...row, existedAtLoad: true } : row))
          rowsRef.current = next
          return next
        })
        setSaveStatus('saved')
        setSaveError(null)
        onSaved()
      } catch (err) {
        setSaveStatus('error')
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle, onSaved],
  )

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void attemptSave(rowsRef.current)
    }, AUTOSAVE_DELAY_MS)
  }, [attemptSave])

  useImperativeHandle(forwardedRef, () => ({
    flushSave: async () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      await attemptSave(rowsRef.current)
    },
  }))

  function applyRowsUpdate(updater: (prev: DraftRow[]) => DraftRow[]) {
    setRows((prev) => {
      const next = updater(prev)
      rowsRef.current = next
      return next
    })
  }

  function updateRow(id: string, patch: Partial<Pick<DraftRow, 'key' | 'value' | 'description'>>) {
    applyRowsUpdate((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    scheduleAutosave()
  }

  function addRow() {
    applyRowsUpdate((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: '', value: '', description: '', existedAtLoad: false },
    ])
  }

  function removeRow(id: string) {
    applyRowsUpdate((prev) => prev.filter((row) => row.id !== id))
    scheduleAutosave()
  }

  function requestDelete(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    if (!row.existedAtLoad) {
      // Never written to disk — nothing destructive to confirm.
      removeRow(id)
      return
    }
    setPendingDeleteId(id)
  }

  function confirmDelete() {
    if (pendingDeleteId) removeRow(pendingDeleteId)
    setPendingDeleteId(null)
  }

  function handleExplicitSave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    void attemptSave(rows)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      handleExplicitSave()
    }
  }

  const pendingDeleteRow = rows.find((row) => row.id === pendingDeleteId) ?? null

  const status = hasErrors
    ? { text: 'Fix errors to save', className: 'text-red-400' }
    : saveStatus === 'saving'
      ? { text: 'Saving…', className: 'text-gray-400' }
      : saveStatus === 'error'
        ? { text: 'Save failed', className: 'text-red-400' }
        : dirty
          ? { text: 'Unsaved', className: 'text-amber-400' }
          : { text: 'Saved', className: 'text-gray-400' }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-800" onKeyDown={handleKeyDown}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium text-gray-200">Variables</h1>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            disabled={hasErrors || !dirty}
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleExplicitSave}
          >
            Save
          </button>
          <span className={`text-xs ${status.className}`}>{status.text}</span>
        </div>
      </header>
      {saveError && <p className="border-b border-gray-700 px-4 py-2 text-sm text-red-400">{saveError}</p>}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="w-1/4 pb-2 pr-2">Key</th>
              <th className="w-1/3 pb-2 pr-2">Value</th>
              <th className="pb-2 pr-2">Description</th>
              <th className="w-8 pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const errors = rowErrors.get(row.id)
              return (
                <tr key={row.id} className="align-top">
                  <td className="pb-2 pr-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(event) => updateRow(row.id, { key: event.target.value })}
                      placeholder="key"
                      className={`w-full rounded border bg-gray-900 px-2 py-1 text-gray-100 placeholder:text-gray-500 focus:outline-none ${
                        errors ? 'border-red-500' : 'border-gray-600 focus:border-violet-400'
                      }`}
                    />
                    {errors && <p className="mt-1 text-xs text-red-400">{errorMessage(errors)}</p>}
                  </td>
                  <td className="pb-2 pr-2">
                    <input
                      type="text"
                      value={row.value}
                      onChange={(event) => updateRow(row.id, { value: event.target.value })}
                      placeholder="value"
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100 placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                    />
                  </td>
                  <td className="pb-2 pr-2">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) => updateRow(row.id, { description: event.target.value })}
                      placeholder="description"
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100 placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                    />
                  </td>
                  <td className="pb-2 text-right">
                    <button
                      type="button"
                      className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400"
                      title="Delete"
                      aria-label={`Delete ${row.key || 'variable'}`}
                      onClick={() => requestDelete(row.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-gray-400">No variables yet.</p>}
        <button
          type="button"
          className="mt-3 rounded border border-gray-600 px-3 py-1.5 text-sm text-violet-400 hover:bg-gray-700"
          onClick={addRow}
        >
          + Add variable
        </button>
      </div>

      {pendingDeleteRow && (
        <ConfirmDialog
          title="Delete variable"
          message={`Delete "${pendingDeleteRow.key}"? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
})
