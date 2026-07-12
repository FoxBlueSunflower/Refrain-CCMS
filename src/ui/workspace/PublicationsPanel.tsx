import { useState } from 'react'
import type { Publication, PublicationNode } from '../../core/publications/types'
import type { PublicationSummary } from '../../fs'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentTitleDialog } from './NewDocumentDialog'

interface PublicationsPanelProps {
  publications: PublicationSummary[]
  selectedPath: string | null
  selectedPublication: Publication | null
  creating: boolean
  deletingPaths: ReadonlySet<string>
  onSelect: (path: string) => void
  /** Returns whether creation succeeded, so the dialog only closes (and the typed title is only discarded) on success — a failure keeps it open with the title intact. */
  onCreate: (title: string) => Promise<boolean>
  onDelete: (path: string) => void
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
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: PublicationsPanelProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null)

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
