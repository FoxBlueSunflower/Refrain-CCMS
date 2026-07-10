export type ToastKind = 'error' | 'info' | 'success'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  persistent: boolean
}

export interface AddToastInput {
  kind: ToastKind
  message: string
  /** Defaults to true for errors (never let a failure vanish unread), false otherwise. */
  persistent?: boolean
}

let nextId = 0

function makeId(): string {
  nextId += 1
  return `toast-${nextId}`
}

export function addToast(toasts: Toast[], input: AddToastInput): Toast[] {
  const persistent = input.persistent ?? input.kind === 'error'
  const toast: Toast = { id: makeId(), kind: input.kind, message: input.message, persistent }
  return [...toasts, toast]
}

export function dismissToast(toasts: Toast[], id: string): Toast[] {
  return toasts.filter((toast) => toast.id !== id)
}
