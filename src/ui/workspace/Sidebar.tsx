import { useEffect, useState } from 'react'
import type { DocTreeNode } from '../../core/workspace/types'
import { readDocTree, readSnippetList } from '../../fs'
import { EmptyState } from '../shared/EmptyState'

interface SidebarProps {
  handle: FileSystemDirectoryHandle
  onOpenWhereUsed?: () => void
  onOpenPublish?: () => void
  onOpenHistory?: () => void
  onOpenTour?: () => void
  onNewDocument?: () => void
  onNewDocumentFolder?: () => void
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
  onSelectDocumentFolder?: (path: string) => void
  onRenameDocumentFolder?: (path: string, currentTitle: string) => void
  onDeleteDocumentFolder?: (path: string) => void
  onNewSnippet?: () => void
  onNewSnippetFolder?: () => void
  onSelectSnippet?: (path: string) => void
  onRenameSnippet?: (path: string) => void
  onDeleteSnippet?: (path: string) => void
  onSelectSnippetFolder?: (path: string) => void
  onRenameSnippetFolder?: (path: string, currentTitle: string) => void
  onDeleteSnippetFolder?: (path: string) => void
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

function useCollapsedState() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }
  return { collapsed, toggle }
}

export function Sidebar({
  handle,
  onOpenWhereUsed,
  onOpenPublish,
  onOpenHistory,
  onOpenTour,
  onNewDocument,
  onNewDocumentFolder,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onSelectDocumentFolder,
  onRenameDocumentFolder,
  onDeleteDocumentFolder,
  onNewSnippet,
  onNewSnippetFolder,
  onSelectSnippet,
  onRenameSnippet,
  onDeleteSnippet,
  onSelectSnippetFolder,
  onRenameSnippetFolder,
  onDeleteSnippetFolder,
  onOpenVariables,
  onOpenConditions,
  onOpenProfiles,
  refreshToken,
}: SidebarProps) {
  const docs = useTree(readDocTree, handle, refreshToken)
  const snippets = useTree(readSnippetList, handle, refreshToken)
  const docsCollapsed = useCollapsedState()
  const snippetsCollapsed = useCollapsedState()

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-gray-700 bg-gray-800 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-400" title={handle.name}>
          {handle.name}
        </h2>
        <div className="flex flex-wrap gap-1">
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
          {onOpenHistory && (
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onOpenHistory}
            >
              History
            </button>
          )}
          {onOpenTour && (
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onOpenTour}
            >
              Tour
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-gray-400">Documents</h2>
          <div className="flex shrink-0 items-center gap-1">
            {onNewDocumentFolder && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                onClick={onNewDocumentFolder}
                title="New folder"
                aria-label="New folder"
              >
                Folder
              </button>
            )}
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
        </div>

        {docs.error && <p className="text-sm text-red-400">{docs.error}</p>}
        {!docs.error && docs.tree === null && <p className="text-sm text-gray-400">Loading documents…</p>}
        {!docs.error && docs.tree !== null && docs.tree.length === 0 && (
          <EmptyState
            title="No documents yet"
            action={onNewDocument ? { label: '+ New document', onClick: onNewDocument } : undefined}
          />
        )}
        {docs.tree && docs.tree.length > 0 && (
          <DocTreeList
            nodes={docs.tree}
            depth={0}
            collapsed={docsCollapsed.collapsed}
            onToggleCollapse={docsCollapsed.toggle}
            onSelectDocument={onSelectDocument}
            onRenameDocument={onRenameDocument}
            onDeleteDocument={onDeleteDocument}
            onSelectFolder={onSelectDocumentFolder}
            onRenameFolder={onRenameDocumentFolder}
            onDeleteFolder={onDeleteDocumentFolder}
          />
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-400">Snippets</h2>
          <div className="flex shrink-0 items-center gap-1">
            {onNewSnippetFolder && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                onClick={onNewSnippetFolder}
                title="New folder"
                aria-label="New folder"
              >
                Folder
              </button>
            )}
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
        </div>
        {snippets.error && <p className="text-sm text-red-400">{snippets.error}</p>}
        {!snippets.error && snippets.tree === null && <p className="text-sm text-gray-400">Loading snippets…</p>}
        {!snippets.error && snippets.tree !== null && snippets.tree.length === 0 && (
          <EmptyState
            title="No snippets yet"
            action={onNewSnippet ? { label: '+ New snippet', onClick: onNewSnippet } : undefined}
          />
        )}
        {snippets.tree && snippets.tree.length > 0 && (
          <DocTreeList
            nodes={snippets.tree}
            depth={0}
            collapsed={snippetsCollapsed.collapsed}
            onToggleCollapse={snippetsCollapsed.toggle}
            onSelectDocument={onSelectSnippet}
            onRenameDocument={onRenameSnippet}
            onDeleteDocument={onDeleteSnippet}
            onSelectFolder={onSelectSnippetFolder}
            onRenameFolder={onRenameSnippetFolder}
            onDeleteFolder={onDeleteSnippetFolder}
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
  collapsed: Set<string>
  onToggleCollapse: (path: string) => void
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
  onSelectFolder?: (path: string) => void
  onRenameFolder?: (path: string, currentTitle: string) => void
  onDeleteFolder?: (path: string) => void
}

function DocTreeList({
  nodes,
  depth,
  collapsed,
  onToggleCollapse,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
}: DocTreeListProps) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-3 space-y-1 border-l border-gray-700 pl-2'}>
      {nodes.map((node) => {
        if (node.kind === 'folder') {
          const hasChildren = !!node.children && node.children.length > 0
          const isEmpty = !hasChildren
          const isCollapsed = collapsed.has(node.path)
          return (
            <li key={node.path}>
              <div className="group flex items-center gap-1">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hover:bg-gray-700"
                  onClick={() => {
                    onToggleCollapse(node.path)
                    onSelectFolder?.(node.path)
                  }}
                >
                  <span className="inline-block w-3 shrink-0 text-gray-500" aria-hidden="true">
                    {hasChildren ? (isCollapsed ? '▸' : '▾') : ''}
                  </span>
                  <span className="truncate">{node.name}</span>
                </button>
                {onRenameFolder && (
                  <button
                    type="button"
                    className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 group-hover:block"
                    title="Rename folder"
                    aria-label={`Rename ${node.name}`}
                    onClick={() => onRenameFolder(node.path, node.name)}
                  >
                    ✎
                  </button>
                )}
                {onDeleteFolder && (
                  <button
                    type="button"
                    className={`hidden shrink-0 rounded px-1 text-xs group-hover:block ${
                      isEmpty ? 'text-gray-400 hover:bg-gray-700 hover:text-red-400' : 'cursor-not-allowed text-gray-600'
                    }`}
                    title={isEmpty ? 'Delete folder' : 'Folder must be empty before deleting'}
                    aria-label={`Delete ${node.name}`}
                    onClick={() => {
                      if (isEmpty) onDeleteFolder(node.path)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {hasChildren && !isCollapsed && (
                <DocTreeList
                  nodes={node.children!}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                  onSelectDocument={onSelectDocument}
                  onRenameDocument={onRenameDocument}
                  onDeleteDocument={onDeleteDocument}
                  onSelectFolder={onSelectFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              )}
            </li>
          )
        }

        return (
          <li key={node.path}>
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
          </li>
        )
      })}
    </ul>
  )
}
