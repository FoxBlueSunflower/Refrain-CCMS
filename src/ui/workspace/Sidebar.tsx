import { useEffect, useState } from 'react'
import type { DocTreeNode } from '../../core/workspace/types'
import { readDocTree, readSnippetList } from '../../fs'

interface SidebarProps {
  handle: FileSystemDirectoryHandle
  onNewDocument?: () => void
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
  onNewSnippet?: () => void
  onSelectSnippet?: (path: string) => void
  onRenameSnippet?: (path: string) => void
  onDeleteSnippet?: (path: string) => void
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
  onNewDocument,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onNewSnippet,
  onSelectSnippet,
  onRenameSnippet,
  onDeleteSnippet,
  refreshToken,
}: SidebarProps) {
  const docs = useTree(readDocTree, handle, refreshToken)
  const snippets = useTree(readSnippetList, handle, refreshToken)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-gray-200 bg-white p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-500">{handle.name}</h2>
          {onNewDocument && (
            <button
              type="button"
              className="rounded px-2 text-lg leading-none text-violet-600 hover:bg-violet-50"
              onClick={onNewDocument}
              title="New document"
              aria-label="New document"
            >
              +
            </button>
          )}
        </div>

        {docs.error && <p className="text-sm text-red-600">{docs.error}</p>}
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
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-500">Snippets</h2>
          {onNewSnippet && (
            <button
              type="button"
              className="rounded px-2 text-lg leading-none text-violet-600 hover:bg-violet-50"
              onClick={onNewSnippet}
              title="New snippet"
              aria-label="New snippet"
            >
              +
            </button>
          )}
        </div>
        {snippets.error && <p className="text-sm text-red-600">{snippets.error}</p>}
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
    <ul className={depth === 0 ? 'space-y-1' : 'ml-3 space-y-1 border-l border-gray-100 pl-2'}>
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
                className="block flex-1 truncate rounded px-1 py-0.5 text-left text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => onSelectDocument?.(node.path)}
              >
                {node.name}
              </button>
              {onRenameDocument && (
                <button
                  type="button"
                  className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 group-hover:block"
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
                  className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600 group-hover:block"
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
