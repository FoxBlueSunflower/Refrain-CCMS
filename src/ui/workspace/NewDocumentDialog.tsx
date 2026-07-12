import { useState, type FormEvent } from 'react'

export interface TemplateOption {
  path: string
  title: string
}

interface DocumentTitleDialogProps {
  heading: string
  submitLabel: string
  initialValue?: string
  placeholder?: string
  /** When non-empty, shows a "Start from" picker above the title input (blank by default). */
  templates?: TemplateOption[]
  onSubmit: (title: string, templatePath: string | null) => void
  onCancel: () => void
}

/** Shared title-prompt dialog, used for "new document"/"new snippet" (optionally with a template picker), "rename", and "new publication". */
export function DocumentTitleDialog({
  heading,
  submitLabel,
  initialValue = '',
  placeholder = 'Document title',
  templates,
  onSubmit,
  onCancel,
}: DocumentTitleDialogProps) {
  const [title, setTitle] = useState(initialValue)
  const [templatePath, setTemplatePath] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed, templatePath || null)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        className="w-full max-w-sm rounded-lg bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold text-gray-100">{heading}</h3>
        {templates && templates.length > 0 && (
          <label className="mt-3 block text-xs text-gray-400">
            Start from
            <select
              value={templatePath}
              onChange={(event) => setTemplatePath(event.target.value)}
              className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 focus:border-violet-400 focus:outline-none"
            >
              <option value="">Blank</option>
              {templates.map((template) => (
                <option key={template.path} value={template.path}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder}
          className="mt-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-1.5 text-sm text-violet-400 hover:bg-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
