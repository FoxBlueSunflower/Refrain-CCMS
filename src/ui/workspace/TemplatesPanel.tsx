import { useState } from 'react'
import type { FrontmatterEntryKind } from '../../core/frontmatter/schema'
import { isArchivedTemplatePath } from '../../core/workspace/templates'
import type { TemplateSummary } from '../../fs'
import { EmptyState } from '../shared/EmptyState'
import { DocumentTitleDialog } from './NewDocumentDialog'

interface TemplatesPanelProps {
  docTemplates: TemplateSummary[]
  snippetTemplates: TemplateSummary[]
  onEdit: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onArchive: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onUnarchive: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onCreate: (entryKind: FrontmatterEntryKind, title: string) => void
  onClose: () => void
}

function TemplateSection({
  label,
  entryKind,
  templates,
  onEdit,
  onArchive,
  onUnarchive,
  onNew,
}: {
  label: string
  entryKind: FrontmatterEntryKind
  templates: TemplateSummary[]
  onEdit: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onArchive: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onUnarchive: (entryKind: FrontmatterEntryKind, relPath: string) => void
  onNew: () => void
}) {
  const active = templates.filter((t) => !isArchivedTemplatePath(t.path))
  const archived = templates.filter((t) => isArchivedTemplatePath(t.path))
  const [showArchived, setShowArchived] = useState(false)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</h4>
        <button
          type="button"
          className="rounded px-2 text-lg leading-none text-violet-400 hover:bg-gray-700"
          onClick={onNew}
          title={`New ${label.toLowerCase()} template`}
          aria-label={`New ${label.toLowerCase()} template`}
        >
          +
        </button>
      </div>

      {active.length === 0 ? (
        <EmptyState title={`No ${label.toLowerCase()} yet`} />
      ) : (
        <ul className="space-y-1">
          {active.map((template) => (
            <li key={template.path} className="flex items-center justify-between gap-2 rounded border border-gray-700 p-2">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-gray-200 hover:text-violet-300"
                onClick={() => onEdit(entryKind, template.path)}
              >
                {template.title}
              </button>
              <button
                type="button"
                className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                onClick={() => onArchive(entryKind, template.path)}
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-200"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-1 space-y-1">
              {archived.map((template) => (
                <li
                  key={template.path}
                  className="flex items-center justify-between gap-2 rounded border border-gray-700 p-2 opacity-70"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-gray-300 hover:text-violet-300"
                    onClick={() => onEdit(entryKind, template.path)}
                  >
                    {template.title}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                    onClick={() => onUnarchive(entryKind, template.path)}
                  >
                    Unarchive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Basic template management UI (Phase 8d): list, edit (via the main editor), and archive/unarchive doc and snippet templates. */
export function TemplatesPanel({
  docTemplates,
  snippetTemplates,
  onEdit,
  onArchive,
  onUnarchive,
  onCreate,
  onClose,
}: TemplatesPanelProps) {
  const [newDialogFor, setNewDialogFor] = useState<FrontmatterEntryKind | null>(null)

  return (
    <>
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-100">Templates</h3>
            <button
              type="button"
              className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-auto p-4">
            <TemplateSection
              label="Document templates"
              entryKind="document"
              templates={docTemplates}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onNew={() => setNewDialogFor('document')}
            />
            <TemplateSection
              label="Snippet templates"
              entryKind="snippet"
              templates={snippetTemplates}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onNew={() => setNewDialogFor('snippet')}
            />
          </div>
        </div>
      </div>

      {newDialogFor && (
        <DocumentTitleDialog
          heading={newDialogFor === 'document' ? 'New document template' : 'New snippet template'}
          submitLabel="Create"
          onSubmit={(title) => {
            onCreate(newDialogFor, title)
            setNewDialogFor(null)
          }}
          onCancel={() => setNewDialogFor(null)}
        />
      )}
    </>
  )
}
