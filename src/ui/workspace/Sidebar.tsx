import { useEffect, useState } from 'react'
import type { DocTreeNode } from '../../core/workspace/types'
import { readDocTree, readSnippetList } from '../../fs'

interface SidebarProps {
  handle: FileSystemDirectoryHandle
  onOpenWhereUsed?: () => void
  onOpenPublish?: () => void
  onNewDocument?: () => void
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
  onNewSnippet?: () => void
  onSelectSnippet?: (path: string) => void
  onRenameSnippet?: (path: string) => void
  onDeleteSnippet?: (path: string) => void
  onOpenVariables?: () => void
  onOpenConditions?: () => void
  onOpenProfiles?: () => void
  /** Bump this to force the tree to re-fetch after an external change. */
  refreshToken?: number
}

function useTree(
  fetcher: (handle: FileSystemDirectoryHandle) => Promise<DocTreeNode[]>,
  handle: FileSystemDirectoryHandle,
  refreshToken: number | undefined,
) {
  const [tree, setTree] = useState<DocTreeNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setTree(null)
    setError(null)
    fetcher(handle)
      .then((result) => {
        if (!cancelled) setTree(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, handle, refreshToken])

  return { tree, error }
}

export function Sidebar({
  handle,
  onOpenWhereUsed,
  onOpenPublish,
  onNewDocument,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onNewSnippet,
  onSelectSnippet,
  onRenameSnippet,
  onDeleteSnippet,
  onOpenVariables,
  onOpenConditions,
  onOpenProfiles,
  refreshToken,
}: SidebarProps) {
  const docs = useTree(readDocTree, handle, refreshToken)
  const snippets = useTree(readSnippetList, handle, refreshToken)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-gray-700 bg-gray-800 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-400">{handle.name}</h2>
        <div className="flex shrink-0 gap-1">
          {onOpenWhereUsed && (
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onOpenWhereUsed}
            >
              Where-used
            </button>
          )}
          {onOpenPublish && (
            <button
              type="button"
              className="rounded border border-violet-600 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-900/40"
              onClick={onOpenPublish}
            >
              Publish
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-gray-400">Documents</h2>
          {onNewDocument && (
            <button
              type="button"
              className="rounded px-2 text-lg leading-none text-violet-400 hover:bg-gray-700"
              onClick={onNewDocument}
              title="New document"
              aria-label="New document"
            >
              +
            </button>
          )}
        </div>

        {docs.error && <p className="text-sm text-red-400">{docs.error}</p>}
        {!docs.error && docs.tree === null && <p className="text-sm text-gray-400">Loading documents…</p>}
        {!docs.error && docs.tree !== null && docs.tree.length === 0 && (
          <p className="text-sm text-gray-400">No documents yet.</p>
        )}
        {docs.tree && docs.tree.length > 0 && (
          <DocTreeList
            nodes={docs.tree}
            depth={0}
            onSelectDocument={onSelectDocument}
            onRenameDocument={onRenameDocument}
            onDeleteDocument={onDeleteDocument}
          />
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-400">Snippets</h2>
          {onNewSnippet && (
            <button
              type="button"
              className="rounded px-2 text-lg leading-none text-violet-400 hover:bg-gray-700"
              onClick={onNewSnippet}
              title="New snippet"
              aria-label="New snippet"
            >
              +
            </button>
          )}
        </div>
        {snippets.error && <p className="text-sm text-red-400">{snippets.error}</p>}
        {!snippets.error && snippets.tree === null && <p className="text-sm text-gray-400">Loading snippets…</p>}
        {!snippets.error && snippets.tree !== null && snippets.tree.length === 0 && (
          <p className="text-sm text-gray-400">No snippets yet.</p>
        )}
        {snippets.tree && snippets.tree.length > 0 && (
          <DocTreeList
            nodes={snippets.tree}
            depth={0}
            onSelectDocument={onSelectSnippet}
            onRenameDocument={onRenameSnippet}
            onDeleteDocument={onDeleteSnippet}
          />
        )}
      </div>

      {onOpenVariables && (
        <div>
          <h2 className="mb-1 truncate text-sm font-semibold uppercase tracking-wide text-gray-400">Variables</h2>
          <button
            type="button"
            className="block w-full truncate rounded px-1 py-0.5 text-left text-sm text-gray-300 hover:bg-gray-700"
            onClick={onOpenVariables}
          >
            Edit variables
          </button>
        </div>
      )}

      {onOpenConditions && (
        <div>
          <h2 className="mb-1 truncate text-sm font-semibold uppercase tracking-wide text-gray-400">Conditions</h2>
          <button
            type="button"
            className="block w-full truncate rounded px-1 py-0.5 text-left text-sm text-gray-300 hover:bg-gray-700"
            onClick={onOpenConditions}
          >
            Edit conditions
          </button>
        </div>
      )}

      {onOpenProfiles && (
        <div>
          <h2 className="mb-1 truncate text-sm font-semibold uppercase tracking-wide text-gray-400">Publish profiles</h2>
          <button
            type="button"
            className="block w-full truncate rounded px-1 py-0.5 text-left text-sm text-gray-300 hover:bg-gray-700"
            onClick={onOpenProfiles}
          >
            Manage profiles
          </button>
        </div>
      )}
    </aside>
  )
}

interface DocTreeListProps {
  nodes: DocTreeNode[]
  depth: number
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
}

function DocTreeList({ nodes, depth, onSelectDocument, onRenameDocument, onDeleteDocument }: DocTreeListProps) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-3 space-y-1 border-l border-gray-700 pl-2'}>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.kind === 'folder' ? (
            <>
              <span className="block cursor-default truncate px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {node.name}
              </span>
              {node.children && node.children.length > 0 && (
                <DocTreeList
                  nodes={node.children}
                  depth={depth + 1}
                  onSelectDocument={onSelectDocument}
                  onRenameDocument={onRenameDocument}
                  onDeleteDocument={onDeleteDocument}
                />
              )}
            </>
          ) : (
            <div className="group flex items-center gap-1">
              <button
                type="button"
                className="block flex-1 truncate rounded px-1 py-0.5 text-left text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => onSelectDocument?.(node.path)}
              >
                {node.name}
              </button>
              {onRenameDocument && (
                <button
                  type="button"
                  className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 group-hover:block"
                  title="Rename"
                  aria-label={`Rename ${node.name}`}
                  onClick={() => onRenameDocument(node.path)}
                >
                  ✎
                </button>
              )}
              {onDeleteDocument && (
                <button
                  type="button"
                  className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400 group-hover:block"
                  title="Delete"
                  aria-label={`Delete ${node.name}`}
                  onClick={() => onDeleteDocument(node.path)}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
