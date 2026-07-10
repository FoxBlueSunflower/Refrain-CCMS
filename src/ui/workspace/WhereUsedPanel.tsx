import { useState } from 'react'
import type { WorkspaceIndex } from '../../core/indexer/types'
import type { SnippetSource } from '../../core/resolver/types'
import type { VariablesFile } from '../../core/workspace/types'
import { EmptyState } from '../shared/EmptyState'

interface WhereUsedPanelProps {
  variables: VariablesFile
  snippets: SnippetSource
  index: WorkspaceIndex
  onOpenDocument: (docPath: string) => void
  onClose: () => void
}

type Kind = 'variable' | 'snippet'
type Selection = { kind: Kind; key: string } | null

function docLabel(docPath: string): string {
  const name = docPath.split('/').pop() ?? docPath
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

/** All known keys for a kind: defined ones (variables.json / snippets/) plus any extra key only seen in the index (e.g. a typo'd reference), sorted. */
function allKeys(defined: string[], used: Record<string, string[]>): string[] {
  return [...new Set([...defined, ...Object.keys(used)])].sort()
}

export function WhereUsedPanel({ variables, snippets, index, onOpenDocument, onClose }: WhereUsedPanelProps) {
  const [selection, setSelection] = useState<Selection>(null)

  const variableKeys = allKeys(Object.keys(variables), index.variables)
  const snippetKeys = allKeys(Object.keys(snippets), index.snippets)
  const usedBy = selection ? (selection.kind === 'variable' ? index.variables : index.snippets)[selection.key] ?? [] : []

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex h-[32rem] w-full max-w-2xl overflow-hidden rounded-lg bg-gray-800 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-56 shrink-0 flex-col overflow-auto border-r border-gray-700 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-100">Where-used</h3>

          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Variables</p>
          {variableKeys.length === 0 && <EmptyState title="None yet" />}
          {variableKeys.map((key) => (
            <button
              key={`variable-${key}`}
              type="button"
              className={`flex items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                selection?.kind === 'variable' && selection.key === key ? 'bg-gray-700 text-gray-100' : 'text-gray-300'
              }`}
              onClick={() => setSelection({ kind: 'variable', key })}
            >
              <span className="truncate">{key}</span>
              <span className="ml-2 shrink-0 text-xs text-gray-400">{index.variables[key]?.length ?? 0}</span>
            </button>
          ))}

          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Snippets</p>
          {snippetKeys.length === 0 && <EmptyState title="None yet" />}
          {snippetKeys.map((key) => (
            <button
              key={`snippet-${key}`}
              type="button"
              className={`flex items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                selection?.kind === 'snippet' && selection.key === key ? 'bg-gray-700 text-gray-100' : 'text-gray-300'
              }`}
              onClick={() => setSelection({ kind: 'snippet', key })}
            >
              <span className="truncate">{key}</span>
              <span className="ml-2 shrink-0 text-xs text-gray-400">{index.snippets[key]?.length ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="truncate text-sm font-medium text-gray-100">
              {selection ? `${selection.kind === 'variable' ? 'Variable' : 'Snippet'}: ${selection.key}` : 'Pick an item'}
            </h4>
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {!selection && <p className="text-sm text-gray-400">Select a variable or snippet on the left to see where it's used.</p>}

          {selection && usedBy.length === 0 && <EmptyState title="Not used anywhere yet" />}

          {selection && usedBy.length > 0 && (
            <ul className="flex-1 space-y-1 overflow-auto">
              {usedBy.map((docPath) => (
                <li key={docPath}>
                  <button
                    type="button"
                    className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                    onClick={() => onOpenDocument(docPath)}
                  >
                    {docLabel(docPath)}
                    <span className="ml-2 text-xs text-gray-500">{docPath}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
