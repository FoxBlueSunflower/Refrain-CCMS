import { useState } from 'react'
import { publicationsForDocuments } from '../../core/indexer/derive'
import type { DocPublicationRef, WorkspaceIndex } from '../../core/indexer/types'
import type { SnippetSource } from '../../core/resolver/types'
import type { VariablesFile } from '../../core/workspace/types'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { EmptyState } from '../shared/EmptyState'

interface WhereUsedPanelProps {
  variables: VariablesFile
  snippets: SnippetSource
  documents: string[]
  index: WorkspaceIndex
  initialSelection?: { kind: Kind; key: string }
  onOpenDocument: (docPath: string) => void
  onOpenSnippet: (name: string) => void
  onOpenPublication: (path: string) => void
  onClose: () => void
}

type Kind = 'variable' | 'snippet' | 'document'
type Selection = { kind: Kind; key: string } | null

function docLabel(docPath: string): string {
  const name = docPath.split('/').pop() ?? docPath
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

/** All known keys for a kind: defined ones (variables.json / snippets/ / docs/) plus any extra key only seen in the index (e.g. a typo'd reference), sorted. */
function allKeys(defined: string[], used: Record<string, unknown>): string[] {
  return [...new Set([...defined, ...Object.keys(used)])].sort()
}

function kindLabel(kind: Kind): string {
  if (kind === 'variable') return 'Variable'
  if (kind === 'snippet') return 'Snippet'
  return 'Document'
}

export function WhereUsedPanel({
  variables,
  snippets,
  documents,
  index,
  initialSelection,
  onOpenDocument,
  onOpenSnippet,
  onOpenPublication,
  onClose,
}: WhereUsedPanelProps) {
  const [selection, setSelection] = useState<Selection>(initialSelection ?? null)

  const variableKeys = allKeys(Object.keys(variables), index.variables)
  const snippetKeys = allKeys(Object.keys(snippets), index.snippets)
  const documentKeys = allKeys(documents, index.documentPublications)
  const snippetsUsingVariable = selection?.kind === 'variable' ? index.variablesUsedBySnippets[selection.key] ?? [] : []
  const documentsUsingSelection =
    selection && selection.kind !== 'document'
      ? (selection.kind === 'variable' ? index.variables : index.snippets)[selection.key] ?? []
      : []
  const snippetsUsingSnippet = selection?.kind === 'snippet' ? index.snippetsUsedBySnippets[selection.key] ?? [] : []
  const publicationsUsingSelection =
    selection && selection.kind !== 'document' ? publicationsForDocuments(index, documentsUsingSelection) : []
  const usedInPublications = selection && selection.kind === 'document' ? index.documentPublications[selection.key] ?? [] : []

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
              <span className="ml-2 shrink-0 text-xs text-gray-400">
                {(index.snippets[key]?.length ?? 0) + (index.snippetsUsedBySnippets[key]?.length ?? 0)}
              </span>
            </button>
          ))}

          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Documents</p>
          {documentKeys.length === 0 && <EmptyState title="None yet" />}
          {documentKeys.map((key) => (
            <button
              key={`document-${key}`}
              type="button"
              className={`flex items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                selection?.kind === 'document' && selection.key === key ? 'bg-gray-700 text-gray-100' : 'text-gray-300'
              }`}
              onClick={() => setSelection({ kind: 'document', key })}
            >
              <span className="truncate">{docLabel(key)}</span>
              <span className="ml-2 shrink-0 text-xs text-gray-400">{index.documentPublications[key]?.length ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="truncate text-sm font-medium text-gray-100">
              {selection ? `${kindLabel(selection.kind)}: ${selection.kind === 'document' ? docLabel(selection.key) : selection.key}` : 'Pick an item'}
            </h4>
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {!selection && <p className="text-sm text-gray-400">Select a variable, snippet, or document on the left to see where it's used.</p>}

          {selection && selection.kind === 'variable' && (
            <div className="flex-1 overflow-auto">
              <CollapsibleSection title="Snippets" count={snippetsUsingVariable.length}>
                <SnippetRefList names={snippetsUsingVariable} onOpenSnippet={onOpenSnippet} />
              </CollapsibleSection>
              <CollapsibleSection title="Documents" count={documentsUsingSelection.length}>
                <DocumentRefList docPaths={documentsUsingSelection} onOpenDocument={onOpenDocument} />
              </CollapsibleSection>
              <CollapsibleSection title="Publications" count={publicationsUsingSelection.length}>
                <PublicationRefList publications={publicationsUsingSelection} onOpenPublication={onOpenPublication} />
              </CollapsibleSection>
            </div>
          )}

          {selection && selection.kind === 'snippet' && (
            <div className="flex-1 overflow-auto">
              <CollapsibleSection title="Used by other snippets" count={snippetsUsingSnippet.length}>
                <SnippetRefList names={snippetsUsingSnippet} onOpenSnippet={onOpenSnippet} />
              </CollapsibleSection>
              <CollapsibleSection title="Documents" count={documentsUsingSelection.length}>
                <DocumentRefList docPaths={documentsUsingSelection} onOpenDocument={onOpenDocument} />
              </CollapsibleSection>
              <CollapsibleSection title="Publications" count={publicationsUsingSelection.length}>
                <PublicationRefList publications={publicationsUsingSelection} onOpenPublication={onOpenPublication} />
              </CollapsibleSection>
            </div>
          )}

          {selection && selection.kind === 'document' && usedInPublications.length === 0 && (
            <EmptyState title="Not included in any publication yet" />
          )}

          {selection && selection.kind === 'document' && usedInPublications.length > 0 && (
            <ul className="flex-1 space-y-1 overflow-auto">
              {usedInPublications.map((pub) => (
                <li key={pub.path}>
                  <button
                    type="button"
                    className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                    onClick={() => onOpenPublication(pub.path)}
                  >
                    {pub.title}
                    <span className="ml-2 text-xs text-gray-500">{pub.path}</span>
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

function SnippetRefList({ names, onOpenSnippet }: { names: string[]; onOpenSnippet: (name: string) => void }) {
  if (names.length === 0) return <EmptyState title="None" />
  return (
    <ul className="space-y-1">
      {names.map((name) => (
        <li key={name}>
          <button
            type="button"
            className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => onOpenSnippet(name)}
          >
            {name}
          </button>
        </li>
      ))}
    </ul>
  )
}

function DocumentRefList({ docPaths, onOpenDocument }: { docPaths: string[]; onOpenDocument: (docPath: string) => void }) {
  if (docPaths.length === 0) return <EmptyState title="None" />
  return (
    <ul className="space-y-1">
      {docPaths.map((docPath) => (
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
  )
}

function PublicationRefList({
  publications,
  onOpenPublication,
}: {
  publications: DocPublicationRef[]
  onOpenPublication: (path: string) => void
}) {
  if (publications.length === 0) return <EmptyState title="None" />
  return (
    <ul className="space-y-1">
      {publications.map((pub) => (
        <li key={pub.path}>
          <button
            type="button"
            className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => onOpenPublication(pub.path)}
          >
            {pub.title}
            <span className="ml-2 text-xs text-gray-500">{pub.path}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
