import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  count: number
  defaultExpanded?: boolean
  children: ReactNode
}

export function CollapsibleSection({ title, count, defaultExpanded = true, children }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className="mb-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-gray-700"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="text-xs text-gray-400">{expanded ? '▾' : '▸'}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</span>
        <span className="ml-auto shrink-0 text-xs text-gray-400">{count}</span>
      </button>
      {expanded && <div className="mt-1 pl-4">{children}</div>}
    </div>
  )
}
