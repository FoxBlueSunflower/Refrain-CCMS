import { useState } from 'react'
import type { BuildWarning } from '../../core/builder/types'
import type { SnapshotDiff } from '../../core/snapshots/types'
import type { PublishProfile } from '../../core/workspace/types'
import { EmptyState } from '../shared/EmptyState'

export interface PublishResultSummary {
  profileName: string
  /** The filename the user chose in the save-zip dialog. */
  savedAs: string
  warnings: BuildWarning[]
  pageCount: number
  changes: SnapshotDiff
}

/** Result of publishing a single publication (Phase 9c) — no snapshot/changelog, just the one output file. */
export interface PublicationPublishResultSummary {
  path: string
  profileName: string
  outputPath: string
  /** The filename the user chose in the save-zip dialog. */
  savedAs: string
  warnings: BuildWarning[]
}

interface PublishPanelProps {
  profiles: Record<string, PublishProfile>
  publishing: boolean
  result: PublishResultSummary | null
  onPublish: (profileName: string) => void
  onClose: () => void
}

export function warningLabel(warning: BuildWarning): string {
  const location = warning.line ? `${warning.file}:${warning.line}` : warning.file
  return `${location} — ${warning.message}`
}

export function PublishPanel({ profiles, publishing, result, onPublish, onClose }: PublishPanelProps) {
  const profileNames = Object.keys(profiles)
  const [selected, setSelected] = useState(profileNames[0] ?? '')

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-100">Publish</h3>
          <button
            type="button"
            className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {profileNames.length === 0 ? (
            <EmptyState
              title="No publish profiles yet"
              description="Add one to workspace.json's publishProfiles to publish."
            />
          ) : (
            <>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Publish profile</p>
                <div className="flex flex-col gap-1">
                  {profileNames.map((name) => (
                    <label key={name} className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="radio"
                        name="publish-profile"
                        value={name}
                        checked={selected === name}
                        onChange={() => setSelected(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="self-start rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={publishing || !selected}
                onClick={() => onPublish(selected)}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}

          {result && (
            <div className="border-t border-gray-700 pt-3">
              <p className="mb-2 text-sm text-gray-200">
                Published "{result.profileName}" — saved {result.savedAs} ({result.pageCount} page
                {result.pageCount === 1 ? '' : 's'} plus a Home page). Unzip it and open index.html to view the site.
              </p>
              <p className="mb-2 text-xs text-gray-400">
                {result.changes.added.length} added · {result.changes.updated.length} updated · {result.changes.removed.length}{' '}
                removed since the last publish.
              </p>
              {result.warnings.length === 0 ? (
                <p className="text-xs text-gray-400">No warnings.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto text-xs text-amber-300">
                  {result.warnings.map((warning, i) => (
                    <li key={i}>{warningLabel(warning)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
