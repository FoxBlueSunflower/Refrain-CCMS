import { useEffect, useState } from 'react'
import type { Publication, PublicationNode } from '../../core/publications/types'
import type { PublishProfile } from '../../core/workspace/types'
import type { PublicationSummary } from '../../fs'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { type PublicationPublishResultSummary, warningLabel } from './PublishPanel'

interface PublicationsPanelProps {
  publications: PublicationSummary[]
  selectedPath: string | null
  selectedPublication: Publication | null
  creating: boolean
  deletingPaths: ReadonlySet<string>
  profiles: Record<string, PublishProfile>
  publishing: boolean
  publishResult: PublicationPublishResultSummary | null
  onSelect: (path: string) => void
  /** Returns whether creation succeeded, so the dialog only closes (and the typed title is only discarded) on success — a failure keeps it open with the title intact. */
  onCreate: (title: string) => Promise<boolean>
  onDelete: (path: string) => void
  onPublish: (path: string, profileName: string) => void
  onClose: () => void
}

function NodeList({ nodes, depth }: { nodes: PublicationNode[]; depth: number }) {
  return (
    <ul className={depth > 0 ? 'ml-4 space-y-1 border-l border-gray-700 pl-3' : 'space-y-1'}>
      {nodes.map((node, index) => (
        <li key={index}>
          {node.type === 'heading' ? (
            <>
              <span className="text-sm font-semibold text-gray-200">{node.title}</span>
              {node.children && node.children.length > 0 && <NodeList nodes={node.children} depth={depth + 1} />}
            </>
          ) : (
            <span className="text-sm text-gray-400">{node.ref}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Phase 9b: publications/ is real (list, create, delete, read-only preview)
 * but the tree editor itself — drag-to-reorder, indent-to-nest, add/remove
 * node — is Phase 9d. The preview below is deliberately non-interactive.
 */
export function PublicationsPanel({
  publications,
  selectedPath,
  selectedPublication,
  creating,
  deletingPaths,
  profiles,
  publishing,
  publishResult,
  onSelect,
  onCreate,
  onDelete,
  onPublish,
  onClose,
}: PublicationsPanelProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null)
  const profileNames = Object.keys(profiles)
  const [selectedProfile, setSelectedProfile] = useState(profileNames[0] ?? '')

  // profiles can still be loading (workspaceConfig hydrates asynchronously) when this
  // panel first mounts — resync once real profile names arrive instead of staying
  // stuck on the empty default from that first render.
  useEffect(() => {
    if (!selectedProfile && profileNames.length > 0) setSelectedProfile(profileNames[0])
  }, [profileNames, selectedProfile])

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="flex w-full max-w-3xl overflow-hidden rounded-lg bg-gray-800 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex w-64 shrink-0 flex-col border-r border-gray-700">
            <div className="flex items-center justify-between gap-2 border-b border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-100">Publications</h3>
              <button
                type="button"
                className="rounded px-2 text-lg leading-none text-violet-400 hover:bg-gray-700 disabled:opacity-50"
                onClick={() => setNewDialogOpen(true)}
                disabled={creating}
                title="New publication"
                aria-label="New publication"
              >
                +
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {publications.length === 0 ? (
                <EmptyState title="No publications yet" />
              ) : (
                <ul className="space-y-1">
                  {publications.map((pub) => (
                    <li
                      key={pub.path}
                      className={`flex items-center justify-between gap-2 rounded border p-2 ${
                        pub.path === selectedPath ? 'border-violet-500 bg-violet-900/20' : 'border-gray-700'
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm text-gray-200 hover:text-violet-300"
                        onClick={() => onSelect(pub.path)}
                      >
                        {pub.title}
                        <span className="ml-1 text-xs text-gray-500">({pub.nodeCount})</span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                        onClick={() => setConfirmDeletePath(pub.path)}
                        disabled={deletingPaths.has(pub.path)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex max-h-[70vh] min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-gray-700 p-4">
              <h4 className="truncate text-sm font-semibold text-gray-100">
                {selectedPublication ? selectedPublication.title : 'Select a publication'}
              </h4>
              <button
                type="button"
                className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedPublication ? (
                selectedPublication.nodes.length === 0 ? (
                  <EmptyState
                    title="No documents yet"
                    description="The publication editor (reorder, nest, add documents) is coming in a future update."
                  />
                ) : (
                  <NodeList nodes={selectedPublication.nodes} depth={0} />
                )
              ) : (
                <EmptyState title="Pick a publication on the left to preview its contents" />
              )}
            </div>

            {selectedPublication && selectedPath && (
              <div className="border-t border-gray-700 p-4">
                {profileNames.length === 0 ? (
                  <EmptyState
                    title="No publish profiles yet"
                    description="Add one to workspace.json's publishProfiles to publish."
                  />
                ) : (
                  <>
                    <div className="mb-3 flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Publish profile</p>
                      <div className="flex flex-wrap gap-3">
                        {profileNames.map((name) => (
                          <label key={name} className="flex items-center gap-2 text-sm text-gray-200">
                            <input
                              type="radio"
                              name="publication-publish-profile"
                              value={name}
                              checked={selectedProfile === name}
                              onChange={() => setSelectedProfile(name)}
                            />
                            {name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={publishing || !selectedProfile}
                      onClick={() => onPublish(selectedPath, selectedProfile)}
                    >
                      {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                  </>
                )}

                {publishResult && publishResult.path === selectedPath && (
                  <div className="mt-3 border-t border-gray-700 pt-3">
                    <p className="mb-2 text-sm text-gray-200">
                      Published "{publishResult.profileName}" — written to publish/{publishResult.outputPath}.
                    </p>
                    {publishResult.warnings.length === 0 ? (
                      <p className="text-xs text-gray-400">No warnings.</p>
                    ) : (
                      <ul className="max-h-32 space-y-1 overflow-auto text-xs text-amber-300">
                        {publishResult.warnings.map((warning, i) => (
                          <li key={i}>{warningLabel(warning)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {newDialogOpen && (
        <DocumentTitleDialog
          heading="New publication"
          submitLabel="Create"
          placeholder="Publication title"
          onSubmit={(title) => {
            void onCreate(title).then((ok) => {
              if (ok) setNewDialogOpen(false)
            })
          }}
          onCancel={() => setNewDialogOpen(false)}
        />
      )}

      {confirmDeletePath && (
        <ConfirmDialog
          title="Delete publication?"
          message={`This removes the publication file only — the documents it references are untouched.`}
          confirmLabel="Delete"
          onConfirm={() => {
            onDelete(confirmDeletePath)
            setConfirmDeletePath(null)
          }}
          onCancel={() => setConfirmDeletePath(null)}
        />
      )}
    </>
  )
}
