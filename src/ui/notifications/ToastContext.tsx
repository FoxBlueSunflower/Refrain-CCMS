import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { addToast, dismissToast, type AddToastInput, type Toast } from './toast-queue'
import { ToastStack } from './ToastStack'

const AUTO_DISMISS_MS = 4000

interface ToastContextValue {
  toasts: Toast[]
  push: (input: AddToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => dismissToast(prev, id))
  }, [])

  const push = useCallback(
    (input: AddToastInput) => {
      setToasts((prev) => {
        const next = addToast(prev, input)
        const added = next[next.length - 1]
        if (!added.persistent) {
          const timer = setTimeout(() => dismiss(added.id), AUTO_DISMISS_MS)
          timersRef.current.set(added.id, timer)
        }
        return next
      })
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToasts(): { push: (input: AddToastInput) => void; dismiss: (id: string) => void } {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used within a ToastProvider')
  return ctx
}
