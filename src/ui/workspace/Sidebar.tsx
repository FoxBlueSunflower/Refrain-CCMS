import { useEffect, useState, type DragEvent } from 'react'
import { computeReorder } from '../../core/workspace/reorder'
import type { DocTreeNode } from '../../core/workspace/types'
import { readDocTree, readSnippetList } from '../../fs'
import { EmptyState } from '../shared/EmptyState'

type Section = 'document' | 'snippet'
type NodeKind = 'file' | 'folder'

export interface SiblingEntry {
  path: string
  kind: NodeKind
}

interface DragInfo {
  section: Section
  kind: NodeKind
  path: string
}

interface DropIndicator {
  section: Section
  /** '' means the section's root drop zone (the section header). */
  path: string
  position: 'before' | 'after' | 'into'
}

/**
 * Moves/reorders a document or snippet. `targetParentPath` is the folder
 * it should end up in ('' for the section root). `orderedEntries`, when
 * present, is the desired final sibling order at that parent (including
 * `sourcePath` at its new position) — omitted for a plain "drop into this
 * folder" move, which just appends with no explicit order.
 */
type DropEntryHandler = (
  sourcePath: string,
  sourceKind: NodeKind,
  targetParentPath: string,
  orderedEntries?: SiblingEntry[],
) => void

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
  onDropDocumentEntry?: DropEntryHandler
  onNewSnippet?: () => void
  onNewSnippetFolder?: () => void
  onSelectSnippet?: (path: string) => void
  onRenameSnippet?: (path: string) => void
  onDeleteSnippet?: (path: string) => void
  onSelectSnippetFolder?: (path: string) => void
  onRenameSnippetFolder?: (path: string, currentTitle: string) => void
  onDeleteSnippetFolder?: (path: string) => void
  onDropSnippetEntry?: DropEntryHandler
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

function relativeY(event: DragEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  return (event.clientY - rect.top) / rect.height
}

function computeZone(event: DragEvent<HTMLElement>, allowInto: boolean): 'before' | 'after' | 'into' {
  const y = relativeY(event)
  if (allowInto && y > 0.25 && y < 0.75) return 'into'
  return y < 0.5 ? 'before' : 'after'
}

/** Builds the desired final sibling order at a drop target, given the pre-move `nodes` list at that level. */
function buildOrderedEntries(
  nodes: DocTreeNode[],
  draggedPath: string,
  draggedKind: NodeKind,
  targetIndex: number,
): SiblingEntry[] {
  const orderedPaths = computeReorder(
    nodes.map((n) => n.path),
    draggedPath,
    targetIndex,
  )
  return orderedPaths.map((path) => {
    if (path === draggedPath) return { path, kind: draggedKind }
    const existing = nodes.find((n) => n.path === path)!
    return { path, kind: existing.kind }
  })
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
  onDropDocumentEntry,
  onNewSnippet,
  onNewSnippetFolder,
  onSelectSnippet,
  onRenameSnippet,
  onDeleteSnippet,
  onSelectSnippetFolder,
  onRenameSnippetFolder,
  onDeleteSnippetFolder,
  onDropSnippetEntry,
  onOpenVariables,
  onOpenConditions,
  onOpenProfiles,
  refreshToken,
}: SidebarProps) {
  const docs = useTree(readDocTree, handle, refreshToken)
  const snippets = useTree(readSnippetList, handle, refreshToken)
  const docsCollapsed = useCollapsedState()
  const snippetsCollapsed = useCollapsedState()

  const [dragging, setDragging] = useState<DragInfo | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)

  function endDrag() {
    setDragging(null)
    setDropIndicator(null)
  }

  function handleRootDrop(section: Section, onDrop: DropEntryHandler | undefined) {
    return (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      if (!dragging || dragging.section !== section) return
      onDrop?.(dragging.path, dragging.kind, '')
      endDrag()
    }
  }

  function handleRootDragOver(section: Section) {
    return (event: DragEvent<HTMLElement>) => {
      if (!dragging || dragging.section !== section) return
      event.preventDefault()
      setDropIndicator({ section, path: '', position: 'into' })
    }
  }

  const rootIsDropTarget = (section: Section) => dropIndicator?.section === section && dropIndicator.path === ''

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
          <h2
            className={`truncate rounded text-xs font-semibold uppercase tracking-wide text-gray-400 ${
              rootIsDropTarget('document') ? 'bg-violet-900/40' : ''
            }`}
            onDragOver={handleRootDragOver('document')}
            onDragLeave={() => setDropIndicator((prev) => (prev?.section === 'document' && prev.path === '' ? null : prev))}
            onDrop={handleRootDrop('document', onDropDocumentEntry)}
          >
            Documents
          </h2>
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
            parentPath=""
            section="document"
            collapsed={docsCollapsed.collapsed}
            onToggleCollapse={docsCollapsed.toggle}
            onSelectDocument={onSelectDocument}
            onRenameDocument={onRenameDocument}
            onDeleteDocument={onDeleteDocument}
            onSelectFolder={onSelectDocumentFolder}
            onRenameFolder={onRenameDocumentFolder}
            onDeleteFolder={onDeleteDocumentFolder}
            onDropEntry={onDropDocumentEntry}
            dragging={dragging}
            setDragging={setDragging}
            dropIndicator={dropIndicator}
            setDropIndicator={setDropIndicator}
            endDrag={endDrag}
          />
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2
            className={`truncate rounded text-sm font-semibold uppercase tracking-wide text-gray-400 ${
              rootIsDropTarget('snippet') ? 'bg-violet-900/40' : ''
            }`}
            onDragOver={handleRootDragOver('snippet')}
            onDragLeave={() => setDropIndicator((prev) => (prev?.section === 'snippet' && prev.path === '' ? null : prev))}
            onDrop={handleRootDrop('snippet', onDropSnippetEntry)}
          >
            Snippets
          </h2>
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
            parentPath=""
            section="snippet"
            collapsed={snippetsCollapsed.collapsed}
            onToggleCollapse={snippetsCollapsed.toggle}
            onSelectDocument={onSelectSnippet}
            onRenameDocument={onRenameSnippet}
            onDeleteDocument={onDeleteSnippet}
            onSelectFolder={onSelectSnippetFolder}
            onRenameFolder={onRenameSnippetFolder}
            onDeleteFolder={onDeleteSnippetFolder}
            onDropEntry={onDropSnippetEntry}
            dragging={dragging}
            setDragging={setDragging}
            dropIndicator={dropIndicator}
            setDropIndicator={setDropIndicator}
            endDrag={endDrag}
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
  parentPath: string
  section: Section
  collapsed: Set<string>
  onToggleCollapse: (path: string) => void
  onSelectDocument?: (path: string) => void
  onRenameDocument?: (path: string) => void
  onDeleteDocument?: (path: string) => void
  onSelectFolder?: (path: string) => void
  onRenameFolder?: (path: string, currentTitle: string) => void
  onDeleteFolder?: (path: string) => void
  onDropEntry?: DropEntryHandler
  dragging: DragInfo | null
  setDragging: (info: DragInfo | null) => void
  dropIndicator: DropIndicator | null
  setDropIndicator: (indicator: DropIndicator | null | ((prev: DropIndicator | null) => DropIndicator | null)) => void
  endDrag: () => void
}

function DocTreeList({
  nodes,
  depth,
  parentPath,
  section,
  collapsed,
  onToggleCollapse,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropEntry,
  dragging,
  setDragging,
  dropIndicator,
  setDropIndicator,
  endDrag,
}: DocTreeListProps) {
  const draggingHere = dragging?.section === section

  function indicatorClassFor(path: string): string {
    if (dropIndicator?.section !== section || dropIndicator.path !== path) return ''
    if (dropIndicator.position === 'before') return 'border-t-2 border-violet-400'
    if (dropIndicator.position === 'after') return 'border-b-2 border-violet-400'
    return 'bg-violet-900/40'
  }

  function handleDragOver(node: DocTreeNode, allowInto: boolean) {
    return (event: DragEvent<HTMLLIElement>) => {
      if (!draggingHere) return
      event.preventDefault()
      const zone = computeZone(event, allowInto)
      setDropIndicator({ section, path: node.path, position: zone })
    }
  }

  function handleDragLeave(node: DocTreeNode) {
    return () => {
      setDropIndicator((prev) => (prev?.section === section && prev.path === node.path ? null : prev))
    }
  }

  function handleDrop(node: DocTreeNode, allowInto: boolean) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault()
      if (!draggingHere || !dragging) return
      const zone = computeZone(event, allowInto)
      if (zone === 'into') {
        onDropEntry?.(dragging.path, dragging.kind, node.path)
      } else {
        const index = nodes.findIndex((n) => n.path === node.path)
        const targetIndex = zone === 'after' ? index + 1 : index
        const orderedEntries = buildOrderedEntries(nodes, dragging.path, dragging.kind, targetIndex)
        onDropEntry?.(dragging.path, dragging.kind, parentPath, orderedEntries)
      }
      endDrag()
    }
  }

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-3 space-y-1 border-l border-gray-700 pl-2'}>
      {nodes.map((node) => {
        if (node.kind === 'folder') {
          const hasChildren = !!node.children && node.children.length > 0
          const isEmpty = !hasChildren
          const isCollapsed = collapsed.has(node.path)
          const allowInto = draggingHere && dragging?.kind === 'file'
          return (
            <li
              key={node.path}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', node.path)
                setDragging({ section, kind: 'folder', path: node.path })
              }}
              onDragEnd={endDrag}
              onDragOver={handleDragOver(node, allowInto)}
              onDragLeave={handleDragLeave(node)}
              onDrop={handleDrop(node, allowInto)}
              className={indicatorClassFor(node.path)}
            >
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
                  parentPath={node.path}
                  section={section}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                  onSelectDocument={onSelectDocument}
                  onRenameDocument={onRenameDocument}
                  onDeleteDocument={onDeleteDocument}
                  onSelectFolder={onSelectFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  onDropEntry={onDropEntry}
                  dragging={dragging}
                  setDragging={setDragging}
                  dropIndicator={dropIndicator}
                  setDropIndicator={setDropIndicator}
                  endDrag={endDrag}
                />
              )}
            </li>
          )
        }

        return (
          <li
            key={node.path}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', node.path)
              setDragging({ section, kind: 'file', path: node.path })
            }}
            onDragEnd={endDrag}
            onDragOver={handleDragOver(node, false)}
            onDragLeave={handleDragLeave(node)}
            onDrop={handleDrop(node, false)}
            className={indicatorClassFor(node.path)}
          >
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
