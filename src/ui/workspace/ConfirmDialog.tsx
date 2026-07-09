interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-lg bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
        <p className="mt-2 text-sm text-gray-300">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-1.5 text-sm text-violet-400 hover:bg-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
