import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ConditionsFile } from '../../core/workspace/types'
import { validateIdentifierKeys, type IdentifierError, type KeyCandidate } from '../../core/workspace/identifier-keys'
import { writeConditionsFile } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'

const AUTOSAVE_DELAY_MS = 1200

interface DraftValue {
  id: string
  value: string
  /** True for values loaded from disk at mount; false for values added this session and never saved. */
  existedAtLoad: boolean
}

interface DraftDimension {
  id: string
  name: string
  values: DraftValue[]
  /** True for dimensions loaded from disk at mount; false for dimensions added this session and never saved. */
  existedAtLoad: boolean
}

interface ConditionsEditorProps {
  handle: FileSystemDirectoryHandle
  /**
   * Read once via a lazy useState initializer — deliberately never resynced
   * from prop changes, same rationale as VariablesEditor.initialVariables:
   * reloadResolverData() re-fires after every save and would otherwise
   * clobber an in-progress (possibly currently-invalid) draft sitting in
   * this panel while it's hidden behind another pane.
   */
  initialConditions: ConditionsFile
  onSaved: () => void
}

export interface ConditionsEditorHandle {
  /** No-op if the current draft is invalid — nothing safe to write. The
   *  draft stays in memory (this component never unmounts) until fixed. */
  flushSave: () => Promise<void>
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type PendingDelete = { kind: 'dimension'; dimensionId: string } | { kind: 'value'; dimensionId: string; valueId: string }

function dimensionsFromConditionsFile(conditions: ConditionsFile): DraftDimension[] {
  return Object.entries(conditions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, values]) => ({
      id: crypto.randomUUID(),
      name,
      values: [...values]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ id: crypto.randomUUID(), value, existedAtLoad: true })),
      existedAtLoad: true,
    }))
}

function serializeDimensions(dimensions: DraftDimension[]): ConditionsFile {
  const result: ConditionsFile = {}
  for (const dimension of dimensions) {
    const name = dimension.name.trim()
    if (!name) continue
    const values = [...new Set(dimension.values.map((v) => v.value.trim()).filter((v) => v.length > 0))]
    result[name] = values
  }
  return result
}

/** Order-independent snapshot for dirty-checking — dimension/value add/delete/reorder never produces a spurious dirty flag. */
function canonicalJson(conditions: ConditionsFile): string {
  const entries: Array<[string, string[]]> = Object.entries(conditions)
    .map(([name, values]): [string, string[]] => [name, [...values].sort()])
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

function errorMessage(errors: IdentifierError[]): string {
  if (errors.includes('empty')) return 'Required'
  const invalid = errors.includes('invalid-format')
  const duplicate = errors.includes('duplicate')
  if (invalid && duplicate) return 'Only letters, numbers, _ and - are allowed, and this is already used'
  if (invalid) return 'Only letters, numbers, _ and - are allowed'
  if (duplicate) return 'Already used'
  return ''
}

export const ConditionsEditor = forwardRef<ConditionsEditorHandle, ConditionsEditorProps>(function ConditionsEditor(
  { handle, initialConditions, onSaved },
  forwardedRef,
) {
  const [dimensions, setDimensions] = useState<DraftDimension[]>(() => dimensionsFromConditionsFile(initialConditions))
  const [newValueDrafts, setNewValueDrafts] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const dimensionsRef = useRef(dimensions)
  const lastSavedRef = useRef(canonicalJson(initialConditions))
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    },
    [],
  )

  const dimensionNameErrors = useMemo(
    () => validateIdentifierKeys(dimensions.map((d): KeyCandidate => ({ id: d.id, key: d.name }))),
    [dimensions],
  )
  const valueErrorsByDimension = useMemo(() => {
    const map = new Map<string, Map<string, IdentifierError[]>>()
    for (const dimension of dimensions) {
      map.set(
        dimension.id,
        validateIdentifierKeys(dimension.values.map((v): KeyCandidate => ({ id: v.id, key: v.value }))),
      )
    }
    return map
  }, [dimensions])
  const hasErrors =
    dimensionNameErrors.size > 0 || dimensions.some((d) => (valueErrorsByDimension.get(d.id)?.size ?? 0) > 0)

  const currentJson = useMemo(() => canonicalJson(serializeDimensions(dimensions)), [dimensions])
  const dirty = currentJson !== lastSavedRef.current

  const attemptSave = useCallback(
    async (currentDimensions: DraftDimension[]) => {
      const nameErrors = validateIdentifierKeys(currentDimensions.map((d): KeyCandidate => ({ id: d.id, key: d.name })))
      if (nameErrors.size > 0) return
      for (const dimension of currentDimensions) {
        const errors = validateIdentifierKeys(dimension.values.map((v): KeyCandidate => ({ id: v.id, key: v.value })))
        if (errors.size > 0) return
      }
      const nextFile = serializeDimensions(currentDimensions)
      const nextJson = canonicalJson(nextFile)
      if (nextJson === lastSavedRef.current) return
      setSaveStatus('saving')
      try {
        await writeConditionsFile(handle, nextFile)
        lastSavedRef.current = nextJson
        setDimensions((prev) => {
          const next = prev.map((d) => ({
            ...d,
            existedAtLoad: d.name.trim() ? true : d.existedAtLoad,
            values: d.values.map((v) => ({ ...v, existedAtLoad: v.value.trim() ? true : v.existedAtLoad })),
          }))
          dimensionsRef.current = next
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
      void attemptSave(dimensionsRef.current)
    }, AUTOSAVE_DELAY_MS)
  }, [attemptSave])

  useImperativeHandle(forwardedRef, () => ({
    flushSave: async () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      await attemptSave(dimensionsRef.current)
    },
  }))

  function applyDimensionsUpdate(updater: (prev: DraftDimension[]) => DraftDimension[]) {
    setDimensions((prev) => {
      const next = updater(prev)
      dimensionsRef.current = next
      return next
    })
  }

  function updateDimensionName(id: string, name: string) {
    applyDimensionsUpdate((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
    scheduleAutosave()
  }

  function addDimension() {
    applyDimensionsUpdate((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', values: [], existedAtLoad: false },
    ])
  }

  function removeDimension(id: string) {
    applyDimensionsUpdate((prev) => prev.filter((d) => d.id !== id))
    scheduleAutosave()
  }

  function requestDeleteDimension(id: string) {
    const dimension = dimensions.find((d) => d.id === id)
    if (!dimension) return
    if (!dimension.existedAtLoad) {
      removeDimension(id)
      return
    }
    setPendingDelete({ kind: 'dimension', dimensionId: id })
  }

  function addValue(dimensionId: string) {
    const text = (newValueDrafts[dimensionId] ?? '').trim()
    if (!text) return
    applyDimensionsUpdate((prev) =>
      prev.map((d) =>
        d.id === dimensionId
          ? { ...d, values: [...d.values, { id: crypto.randomUUID(), value: text, existedAtLoad: false }] }
          : d,
      ),
    )
    setNewValueDrafts((prev) => ({ ...prev, [dimensionId]: '' }))
    scheduleAutosave()
  }

  function updateValueText(dimensionId: string, valueId: string, value: string) {
    applyDimensionsUpdate((prev) =>
      prev.map((d) =>
        d.id === dimensionId ? { ...d, values: d.values.map((v) => (v.id === valueId ? { ...v, value } : v)) } : d,
      ),
    )
    scheduleAutosave()
  }

  function removeValue(dimensionId: string, valueId: string) {
    applyDimensionsUpdate((prev) =>
      prev.map((d) => (d.id === dimensionId ? { ...d, values: d.values.filter((v) => v.id !== valueId) } : d)),
    )
    scheduleAutosave()
  }

  function requestDeleteValue(dimensionId: string, valueId: string) {
    const dimension = dimensions.find((d) => d.id === dimensionId)
    const value = dimension?.values.find((v) => v.id === valueId)
    if (!value) return
    if (!value.existedAtLoad) {
      removeValue(dimensionId, valueId)
      return
    }
    setPendingDelete({ kind: 'value', dimensionId, valueId })
  }

  function confirmDelete() {
    if (pendingDelete?.kind === 'dimension') removeDimension(pendingDelete.dimensionId)
    else if (pendingDelete?.kind === 'value') removeValue(pendingDelete.dimensionId, pendingDelete.valueId)
    setPendingDelete(null)
  }

  function handleExplicitSave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    void attemptSave(dimensions)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      handleExplicitSave()
    }
  }

  const pendingDeleteDimension =
    pendingDelete?.kind === 'dimension' ? (dimensions.find((d) => d.id === pendingDelete.dimensionId) ?? null) : null
  const pendingDeleteValue =
    pendingDelete?.kind === 'value'
      ? (dimensions.find((d) => d.id === pendingDelete.dimensionId)?.values.find((v) => v.id === pendingDelete.valueId) ??
        null)
      : null

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
        <h1 className="truncate text-sm font-medium text-gray-200">Conditions</h1>
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
        <div className="space-y-4">
          {dimensions.map((dimension) => {
            const nameErrors = dimensionNameErrors.get(dimension.id)
            const valueErrors = valueErrorsByDimension.get(dimension.id)
            return (
              <div key={dimension.id} className="rounded border border-gray-700 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={dimension.name}
                      onChange={(event) => updateDimensionName(dimension.id, event.target.value)}
                      placeholder="dimension name"
                      className={`w-full rounded border bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none ${
                        nameErrors ? 'border-red-500' : 'border-gray-600 focus:border-violet-400'
                      }`}
                    />
                    {nameErrors && <p className="mt-1 text-xs text-red-400">{errorMessage(nameErrors)}</p>}
                  </div>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400"
                    title="Delete dimension"
                    aria-label={`Delete ${dimension.name || 'dimension'}`}
                    onClick={() => requestDeleteDimension(dimension.id)}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {dimension.values.map((value) => {
                    const valueError = valueErrors?.get(value.id)
                    return (
                      <div key={value.id} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={value.value}
                          onChange={(event) => updateValueText(dimension.id, value.id, event.target.value)}
                          className={`w-28 rounded border bg-gray-900 px-2 py-0.5 text-xs text-gray-100 focus:outline-none ${
                            valueError ? 'border-red-500' : 'border-gray-600 focus:border-violet-400'
                          }`}
                        />
                        <button
                          type="button"
                          className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400"
                          title="Remove value"
                          aria-label={`Remove ${value.value || 'value'}`}
                          onClick={() => requestDeleteValue(dimension.id, value.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newValueDrafts[dimension.id] ?? ''}
                      onChange={(event) =>
                        setNewValueDrafts((prev) => ({ ...prev, [dimension.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addValue(dimension.id)
                        }
                      }}
                      placeholder="+ value"
                      className="w-24 rounded border border-dashed border-gray-600 bg-gray-900 px-2 py-0.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {dimensions.length === 0 && <p className="text-sm text-gray-400">No condition dimensions yet.</p>}
        <button
          type="button"
          className="mt-3 rounded border border-gray-600 px-3 py-1.5 text-sm text-violet-400 hover:bg-gray-700"
          onClick={addDimension}
        >
          + Add dimension
        </button>
      </div>

      {pendingDeleteDimension && (
        <ConfirmDialog
          title="Delete dimension"
          message={`Delete dimension "${pendingDeleteDimension.name}"? This removes all ${pendingDeleteDimension.values.length} of its values and can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {pendingDeleteValue && (
        <ConfirmDialog
          title="Delete value"
          message={`Delete value "${pendingDeleteValue.value}"? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
})
