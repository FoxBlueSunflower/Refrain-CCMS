import type { Toast, ToastKind } from './toast-queue'

interface ToastStackProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const KIND_STYLES: Record<ToastKind, string> = {
  error: 'border-red-600 text-red-200',
  info: 'border-violet-600 text-violet-200',
  success: 'border-emerald-600 text-emerald-200',
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-lg border bg-gray-800 p-3 text-sm shadow-xl ${KIND_STYLES[toast.kind]}`}
        >
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            className="shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
