import { useState, type FormEvent } from 'react'

interface DocumentTitleDialogProps {
  heading: string
  submitLabel: string
  initialValue?: string
  onSubmit: (title: string) => void
  onCancel: () => void
}

/** Shared title-prompt dialog, used for both "new document" and "rename". */
export function DocumentTitleDialog({
  heading,
  submitLabel,
  initialValue = '',
  onSubmit,
  onCancel,
}: DocumentTitleDialogProps) {
  const [title, setTitle] = useState(initialValue)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        className="w-full max-w-sm rounded-lg bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold text-gray-100">{heading}</h3>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
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
