import { useState } from 'react'
import { coerceScalar, type FrontmatterScalar } from '../../core/frontmatter/parse'
import { FRONTMATTER_SCHEMA, isKnownFrontmatterKey, type FrontmatterEntryKind } from '../../core/frontmatter/schema'

interface CustomRow {
  id: string
  key: string
  value: string
}

interface FrontmatterFormPanelProps {
  entryKind: FrontmatterEntryKind
  frontmatter: Record<string, FrontmatterScalar>
  warnings: string[]
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Sets (never deletes) a key — used for known fields and for a custom row's value. */
  onFieldChange: (key: string, value: FrontmatterScalar) => void
  /** Renames a custom row's key in place, carrying its current value along. */
  onKeyRename: (oldKey: string, newKey: string, value: FrontmatterScalar) => void
  /** Removes a custom row's key entirely (the row's own "delete" action, distinct from clearing a known field). */
  onFieldDelete: (key: string) => void
}

function displayValue(value: FrontmatterScalar | undefined): string {
  if (value === undefined || value === null) return ''
  return String(value)
}

/**
 * Custom rows are seeded once at mount from whichever frontmatter keys
 * aren't in the schema, then managed entirely as local state. Safe because
 * FrontmatterFormPanel lives inside EditorPane, which is remounted per file
 * (key={fullPath}) — a fresh file open always gets a fresh seed, and nothing
 * else can add/remove custom keys behind this panel's back mid-session
 * (every mutation to the document's custom keys originates from this panel).
 */
function seedCustomRows(entryKind: FrontmatterEntryKind, frontmatter: Record<string, FrontmatterScalar>): CustomRow[] {
  return Object.entries(frontmatter)
    .filter(([key]) => !isKnownFrontmatterKey(entryKind, key))
    .map(([key, value]) => ({ id: crypto.randomUUID(), key, value: displayValue(value) }))
}

export function FrontmatterFormPanel({
  entryKind,
  frontmatter,
  warnings,
  collapsed,
  onToggleCollapsed,
  onFieldChange,
  onKeyRename,
  onFieldDelete,
}: FrontmatterFormPanelProps) {
  const [customRows, setCustomRows] = useState<CustomRow[]>(() => seedCustomRows(entryKind, frontmatter))
  const expanded = !collapsed || warnings.length > 0

  function updateCustomKey(id: string, newKey: string) {
    const row = customRows.find((r) => r.id === id)
    if (!row) return
    const oldKey = row.key.trim()
    const trimmedNewKey = newKey.trim()
    setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, key: newKey } : r)))
    if (!trimmedNewKey) return
    if (oldKey) onKeyRename(oldKey, trimmedNewKey, coerceScalar(row.value))
    else onFieldChange(trimmedNewKey, coerceScalar(row.value))
  }

  function updateCustomValue(id: string, newValue: string) {
    const row = customRows.find((r) => r.id === id)
    if (!row) return
    setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, value: newValue } : r)))
    const key = row.key.trim()
    if (key) onFieldChange(key, coerceScalar(newValue))
  }

  function addCustomRow() {
    setCustomRows((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])
  }

  function removeCustomRow(id: string) {
    const row = customRows.find((r) => r.id === id)
    setCustomRows((prev) => prev.filter((r) => r.id !== id))
    const key = row?.key.trim()
    if (key) onFieldDelete(key)
  }

  return (
    <div className="border-b border-gray-700 bg-gray-800">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left"
        onClick={onToggleCollapsed}
        aria-expanded={expanded}
      >
        <span className="text-xs text-gray-400">{expanded ? '▾' : '▸'}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Frontmatter</span>
        {warnings.length > 0 && <span className="text-xs text-amber-400">⚠ {warnings.length}</span>}
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          {warnings.length > 0 && (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {FRONTMATTER_SCHEMA[entryKind].map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <label className="w-32 shrink-0 text-xs text-gray-400" htmlFor={`fm-${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`fm-${field.key}`}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={displayValue(frontmatter[field.key])}
                  onChange={(event) =>
                    onFieldChange(
                      field.key,
                      field.type === 'number'
                        ? event.target.value === ''
                          ? ''
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                  className="w-full min-w-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 focus:border-violet-400 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {customRows.length > 0 && (
            <div className="mt-3 space-y-2">
              {customRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(event) => updateCustomKey(row.id, event.target.value)}
                    placeholder="key"
                    className="w-32 shrink-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(event) => updateCustomValue(row.id, event.target.value)}
                    placeholder="value"
                    className="w-full min-w-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400"
                    title="Delete"
                    aria-label={`Delete ${row.key || 'custom field'}`}
                    onClick={() => removeCustomRow(row.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="mt-3 rounded border border-gray-600 px-2 py-1 text-xs text-violet-400 hover:bg-gray-700"
            onClick={addCustomRow}
          >
            + Add custom field
          </button>
        </div>
      )}
    </div>
  )
}
