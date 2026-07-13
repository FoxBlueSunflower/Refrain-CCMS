import { useEffect, useState } from 'react'
import { getNodeAt, indentNode, insertNode, moveNode, outdentNode, removeNode, renameHeading, type NodePath } from '../../core/publications/edit'
import type { Publication, PublicationNode } from '../../core/publications/types'
import type { PublishProfile } from '../../core/workspace/types'
import type { PublicationSummary } from '../../fs'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'
import { PublicationTree } from './PublicationTree'
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
  documentPaths: ReadonlySet<string>
  onSelect: (path: string) => void
  /** Returns whether creation succeeded, so the dialog only closes (and the typed title is only discarded) on success — a failure keeps it open with the title intact. */
  onCreate: (title: string) => Promise<boolean>
  onDelete: (path: string) => void
  onPublish: (path: string, profileName: string) => void
  /** Applies a pure `PublicationNode[]` transform to the selected publication and persists the result. */
  onEditPublication: (mutate: (nodes: PublicationNode[]) => PublicationNode[]) => void
  onClose: () => void
}

/** Index (append position) at the end of the children array addressed by `parentPath` ('' for root). */
function appendIndex(nodes: PublicationNode[], parentPath: NodePath): number {
  if (parentPath.length === 0) return nodes.length
  const parent = getNodeAt(nodes, parentPath)
  return parent ? (parent.children?.length ?? 0) : 0
}

export function PublicationsPanel({
  publications,
  selectedPath,
  selectedPublication,
  creating,
  deletingPaths,
  profiles,
  publishing,
  publishResult,
  documentPaths,
  onSelect,
  onCreate,
  onDelete,
  onPublish,
  onEditPublication,
  onClose,
}: PublicationsPanelProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null)
  const [addHeadingParentPath, setAddHeadingParentPath] = useState<NodePath | null>(null)
  const [addDocParentPath, setAddDocParentPath] = useState<NodePath | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ path: NodePath; title: string } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ path: NodePath; node: PublicationNode } | null>(null)
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
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
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
                <>
                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                      onClick={() => setAddHeadingParentPath([])}
                    >
                      + Heading
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      disabled={documentPaths.size === 0}
                      onClick={() => setAddDocParentPath([])}
                    >
                      + Document
                    </button>
                  </div>
                  {selectedPublication.nodes.length === 0 ? (
                    <EmptyState
                      title="No documents yet"
                      description="Use + Heading or + Document above to start building this publication's structure."
                    />
                  ) : (
                    <PublicationTree
                      nodes={selectedPublication.nodes}
                      onMove={(fromPath, toParentPath, toIndex) =>
                        onEditPublication((nodes) => moveNode(nodes, fromPath, toParentPath, toIndex))
                      }
                      onIndent={(path) => onEditPublication((nodes) => indentNode(nodes, path))}
                      onOutdent={(path) => onEditPublication((nodes) => outdentNode(nodes, path))}
                      onRequestRemove={(path, node) => {
                        const hasChildren = (node.children?.length ?? 0) > 0
                        if (hasChildren) {
                          setRemoveTarget({ path, node })
                        } else {
                          onEditPublication((nodes) => removeNode(nodes, path))
                        }
                      }}
                      onAddHeadingUnder={(parentPath) => setAddHeadingParentPath(parentPath)}
                      onAddDocUnder={(parentPath) => setAddDocParentPath(parentPath)}
                      onRenameHeading={(path, title) => setRenameTarget({ path, title })}
                    />
                  )}
                </>
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
                      Published "{publishResult.profileName}" — saved {publishResult.savedAs}. Unzip it and open
                      index.html to view the site.
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

      {addHeadingParentPath !== null && (
        <DocumentTitleDialog
          heading="Add heading"
          submitLabel="Add"
          placeholder="Heading title"
          onSubmit={(title) => {
            const parentPath = addHeadingParentPath
            onEditPublication((nodes) => insertNode(nodes, parentPath, appendIndex(nodes, parentPath), { type: 'heading', title }))
            setAddHeadingParentPath(null)
          }}
          onCancel={() => setAddHeadingParentPath(null)}
        />
      )}

      {renameTarget && (
        <DocumentTitleDialog
          heading="Rename heading"
          submitLabel="Rename"
          initialValue={renameTarget.title}
          placeholder="Heading title"
          onSubmit={(title) => {
            const path = renameTarget.path
            onEditPublication((nodes) => renameHeading(nodes, path, title))
            setRenameTarget(null)
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {addDocParentPath !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={() => setAddDocParentPath(null)}>
          <div
            className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-lg bg-gray-800 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-100">Add document</h3>
              <button
                type="button"
                className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                onClick={() => setAddDocParentPath(null)}
              >
                Cancel
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {[...documentPaths].sort().map((docPath) => (
                <button
                  key={docPath}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                  onClick={() => {
                    const parentPath = addDocParentPath
                    onEditPublication((nodes) =>
                      insertNode(nodes, parentPath, appendIndex(nodes, parentPath), { type: 'doc', ref: `docs/${docPath}` }),
                    )
                    setAddDocParentPath(null)
                  }}
                >
                  {docPath}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title={removeTarget.node.type === 'heading' ? 'Remove this heading?' : 'Remove this document?'}
          message="This removes it and everything nested under it from this publication's structure. The documents themselves are untouched — only this publication's tree changes."
          confirmLabel="Remove"
          onConfirm={() => {
            const path = removeTarget.path
            onEditPublication((nodes) => removeNode(nodes, path))
            setRemoveTarget(null)
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </>
  )
}
