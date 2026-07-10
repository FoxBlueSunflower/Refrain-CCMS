import { SHORTCUTS } from './shortcuts'

interface ShortcutsHelpDialogProps {
  onClose: () => void
}

export function ShortcutsHelpDialog({ onClose }: ShortcutsHelpDialogProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">Keyboard shortcuts</h3>
          <button
            type="button"
            className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-300">{shortcut.description}</span>
              <kbd className="shrink-0 rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-xs text-gray-300">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
