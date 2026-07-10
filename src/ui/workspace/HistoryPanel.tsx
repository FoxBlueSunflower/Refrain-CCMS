import { useState } from 'react'
import type { ConditionDiscrepancy, PublishLogEntry, SnapshotKind, VariableDiscrepancy } from '../../core/snapshots/types'
import type { SnapshotSummary } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'

interface HistoryPanelProps {
  snapshots: SnapshotSummary[]
  publishLog: PublishLogEntry[]
  snapshotting: boolean
  restoring: boolean
  error: string | null
  discrepancies: { variables: VariableDiscrepancy[]; conditions: ConditionDiscrepancy[] } | null
  onSaveNow: () => void
  onRestore: (snapshotName: string) => void
  onClose: () => void
}

const KIND_LABELS: Record<SnapshotKind, string> = {
  publish: 'Publish',
  manual: 'Manual save-point',
  restore: 'Pre-restore backup',
}

function formatTimestamp(timestamp: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})$/.exec(timestamp)
  if (!match) return timestamp
  const [, date, hours, minutes] = match
  return `${date} ${hours}:${minutes}`
}

function variableDiscrepancyLabel(d: VariableDiscrepancy): string {
  if (d.before === undefined) return `${d.key}: added "${d.after}"`
  if (d.after === undefined) return `${d.key}: removed`
  return `${d.key}: "${d.before}" → "${d.after}"`
}

function conditionDiscrepancyLabel(d: ConditionDiscrepancy): string {
  if (d.before === undefined) return `${d.dimension}: added ${JSON.stringify(d.after)}`
  if (d.after === undefined) return `${d.dimension}: removed`
  return `${d.dimension}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`
}

export function HistoryPanel({
  snapshots,
  publishLog,
  snapshotting,
  restoring,
  error,
  discrepancies,
  onSaveNow,
  onRestore,
  onClose,
}: HistoryPanelProps) {
  const [confirmName, setConfirmName] = useState<string | null>(null)

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-100">History</h3>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={snapshotting}
                onClick={onSaveNow}
              >
                {snapshotting ? 'Saving…' : 'Save point'}
              </button>
              <button
                type="button"
                className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {error && <p className="text-sm text-red-400">{error}</p>}

            {discrepancies && (
              <div className="rounded border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-300">
                <p className="mb-1 font-semibold text-gray-100">Restored.</p>
                {discrepancies.variables.length === 0 && discrepancies.conditions.length === 0 ? (
                  <p>No variable or condition differences.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {discrepancies.variables.map((d) => (
                      <li key={`variable-${d.key}`}>Variable {variableDiscrepancyLabel(d)}</li>
                    ))}
                    {discrepancies.conditions.map((d) => (
                      <li key={`condition-${d.dimension}`}>Condition {conditionDiscrepancyLabel(d)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {snapshots.length === 0 ? (
              <p className="text-sm text-gray-400">
                No snapshots yet — publish or take a save point to start building history.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-auto">
                {snapshots.map((snapshot) => {
                  const logEntry =
                    snapshot.kind === 'publish' ? publishLog.find((e) => e.snapshot === snapshot.name) : undefined
                  return (
                    <li
                      key={snapshot.name}
                      className="flex items-center justify-between gap-3 rounded border border-gray-700 p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-200">
                          {formatTimestamp(snapshot.timestamp)} — {KIND_LABELS[snapshot.kind]}
                        </p>
                        {logEntry && (
                          <p className="truncate text-xs text-gray-400">
                            {logEntry.profile} · {logEntry.changes.added.length} added · {logEntry.changes.updated.length}{' '}
                            updated · {logEntry.changes.removed.length} removed
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-violet-300 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={restoring}
                        onClick={() => setConfirmName(snapshot.name)}
                      >
                        Restore
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {confirmName && (
        <ConfirmDialog
          title="Restore snapshot"
          message="Your current docs, snippets, variables, and conditions will be saved as a new backup first, then replaced with this snapshot's content. Nothing is destroyed."
          confirmLabel="Restore"
          onConfirm={() => {
            onRestore(confirmName)
            setConfirmName(null)
          }}
          onCancel={() => setConfirmName(null)}
        />
      )}
    </>
  )
}
