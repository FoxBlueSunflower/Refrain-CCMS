import { useState, type DragEvent } from 'react'
import type { NodePath } from '../../core/publications/edit'
import type { PublicationNode } from '../../core/publications/types'

interface DragInfo {
  path: NodePath
}

interface DropIndicator {
  path: NodePath
  position: 'before' | 'after' | 'into'
}

export interface PublicationTreeProps {
  nodes: PublicationNode[]
  onMove: (fromPath: NodePath, toParentPath: NodePath, toIndex: number) => void
  onIndent: (path: NodePath) => void
  onOutdent: (path: NodePath) => void
  onRequestRemove: (path: NodePath, node: PublicationNode) => void
  onAddHeadingUnder: (parentPath: NodePath) => void
  onAddDocUnder: (parentPath: NodePath) => void
  onRenameHeading: (path: NodePath, currentTitle: string) => void
}

function relativeY(event: DragEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  return (event.clientY - rect.top) / rect.height
}

function computeZone(event: DragEvent<HTMLElement>): 'before' | 'after' | 'into' {
  const y = relativeY(event)
  if (y > 0.25 && y < 0.75) return 'into'
  return y < 0.5 ? 'before' : 'after'
}

function pathKey(path: NodePath): string {
  return path.join('.')
}

function docLabel(ref: string): string {
  const name = ref.split('/').pop() ?? ref
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

interface RowListProps extends PublicationTreeProps {
  depth: number
  parentPath: NodePath
  dragging: DragInfo | null
  setDragging: (info: DragInfo | null) => void
  dropIndicator: DropIndicator | null
  setDropIndicator: (indicator: DropIndicator | null) => void
  endDrag: () => void
}

function RowList({
  nodes,
  depth,
  parentPath,
  dragging,
  setDragging,
  dropIndicator,
  setDropIndicator,
  endDrag,
  onMove,
  onIndent,
  onOutdent,
  onRequestRemove,
  onAddHeadingUnder,
  onAddDocUnder,
  onRenameHeading,
}: RowListProps) {
  function indicatorClassFor(path: NodePath): string {
    if (!dropIndicator || pathKey(dropIndicator.path) !== pathKey(path)) return ''
    if (dropIndicator.position === 'before') return 'border-t-2 border-violet-400'
    if (dropIndicator.position === 'after') return 'border-b-2 border-violet-400'
    return 'bg-violet-900/40'
  }

  function handleDragOver(path: NodePath) {
    return (event: DragEvent<HTMLLIElement>) => {
      if (!dragging) return
      event.preventDefault()
      event.stopPropagation()
      setDropIndicator({ path, position: computeZone(event) })
    }
  }

  function handleDragLeave(path: NodePath) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.stopPropagation()
      setDropIndicator(dropIndicator && pathKey(dropIndicator.path) === pathKey(path) ? null : dropIndicator)
    }
  }

  function handleDrop(node: PublicationNode, path: NodePath, index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!dragging) return
      const zone = computeZone(event)
      if (zone === 'into') {
        const childCount = node.children?.length ?? 0
        onMove(dragging.path, path, childCount)
      } else {
        const targetIndex = zone === 'after' ? index + 1 : index
        onMove(dragging.path, parentPath, targetIndex)
      }
      endDrag()
    }
  }

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-4 space-y-1 border-l border-gray-700 pl-3'}>
      {nodes.map((node, index) => {
        const path = [...parentPath, index]
        const isHeading = node.type === 'heading'
        const children = node.children ?? []
        const canOutdent = depth > 0
        const canIndent = index > 0

        return (
          <li
            key={pathKey(path)}
            draggable
            onDragStart={(event) => {
              event.stopPropagation()
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', pathKey(path))
              setDragging({ path })
            }}
            onDragEnd={endDrag}
            onDragOver={handleDragOver(path)}
            onDragLeave={handleDragLeave(path)}
            onDrop={handleDrop(node, path, index)}
            className={indicatorClassFor(path)}
          >
            <div className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-700/50">
              <span className="shrink-0 cursor-grab text-gray-500" aria-hidden="true">
                ⠿
              </span>
              {isHeading ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-gray-200 hover:text-violet-300"
                  title="Rename heading"
                  onClick={() => onRenameHeading(path, node.title)}
                >
                  {node.title}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-gray-400">{docLabel(node.ref)}</span>
              )}

              <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  type="button"
                  className="rounded px-1 text-xs text-gray-400 hover:bg-gray-600 hover:text-gray-100"
                  title="Add heading here"
                  onClick={() => onAddHeadingUnder(path)}
                >
                  +H
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs text-gray-400 hover:bg-gray-600 hover:text-gray-100"
                  title="Add document here"
                  onClick={() => onAddDocUnder(path)}
                >
                  +Doc
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs text-gray-400 hover:bg-gray-600 hover:text-gray-100 disabled:opacity-30"
                  title="Outdent"
                  disabled={!canOutdent}
                  onClick={() => onOutdent(path)}
                >
                  ◂
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs text-gray-400 hover:bg-gray-600 hover:text-gray-100 disabled:opacity-30"
                  title="Indent"
                  disabled={!canIndent}
                  onClick={() => onIndent(path)}
                >
                  ▸
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-xs text-gray-400 hover:bg-gray-600 hover:text-red-400"
                  title="Remove"
                  aria-label={`Remove ${isHeading ? node.title : node.ref}`}
                  onClick={() => onRequestRemove(path, node)}
                >
                  ✕
                </button>
              </span>
            </div>

            {children.length > 0 && (
              <RowList
                nodes={children}
                depth={depth + 1}
                parentPath={path}
                dragging={dragging}
                setDragging={setDragging}
                dropIndicator={dropIndicator}
                setDropIndicator={setDropIndicator}
                endDrag={endDrag}
                onMove={onMove}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onRequestRemove={onRequestRemove}
                onAddHeadingUnder={onAddHeadingUnder}
                onAddDocUnder={onAddDocUnder}
                onRenameHeading={onRenameHeading}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Interactive publication tree editor (Phase 9d): drag-to-reorder/nest, indent/outdent, add/remove/rename nodes. */
export function PublicationTree(props: PublicationTreeProps) {
  const [dragging, setDragging] = useState<DragInfo | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)

  function endDrag() {
    setDragging(null)
    setDropIndicator(null)
  }

  function handleRootDragOver(event: DragEvent<HTMLDivElement>) {
    if (!dragging || props.nodes.length > 0) return
    event.preventDefault()
    setDropIndicator({ path: [], position: 'into' })
  }

  function handleRootDrop(event: DragEvent<HTMLDivElement>) {
    if (!dragging || props.nodes.length > 0) return
    event.preventDefault()
    props.onMove(dragging.path, [], 0)
    endDrag()
  }

  return (
    <div onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
      <RowList
        {...props}
        depth={0}
        parentPath={[]}
        dragging={dragging}
        setDragging={setDragging}
        dropIndicator={dropIndicator}
        setDropIndicator={setDropIndicator}
        endDrag={endDrag}
      />
    </div>
  )
}
