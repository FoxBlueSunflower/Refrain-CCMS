import { describe, expect, it } from 'vitest'
import { addToast, dismissToast, type Toast } from './toast-queue'

describe('addToast', () => {
  it('appends a toast with a unique id', () => {
    const toasts = addToast(addToast([], { kind: 'info', message: 'first' }), { kind: 'info', message: 'second' })
    expect(toasts).toHaveLength(2)
    expect(toasts[0].id).not.toBe(toasts[1].id)
    expect(toasts.map((t) => t.message)).toEqual(['first', 'second'])
  })

  it('defaults error toasts to persistent', () => {
    const [toast] = addToast([], { kind: 'error', message: 'boom' })
    expect(toast.persistent).toBe(true)
  })

  it('defaults info and success toasts to non-persistent', () => {
    const [info] = addToast([], { kind: 'info', message: 'fyi' })
    const [success] = addToast([], { kind: 'success', message: 'done' })
    expect(info.persistent).toBe(false)
    expect(success.persistent).toBe(false)
  })

  it('lets an explicit persistent flag override the kind default', () => {
    const [toast] = addToast([], { kind: 'info', message: 'fyi', persistent: true })
    expect(toast.persistent).toBe(true)
  })

  it('does not mutate the input array', () => {
    const original: Toast[] = []
    addToast(original, { kind: 'info', message: 'hi' })
    expect(original).toHaveLength(0)
  })
})

describe('dismissToast', () => {
  it('removes only the toast with the matching id', () => {
    const toasts = addToast(addToast([], { kind: 'info', message: 'a' }), { kind: 'info', message: 'b' })
    const remaining = dismissToast(toasts, toasts[0].id)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].message).toBe('b')
  })

  it('is a no-op for an unknown id', () => {
    const toasts = addToast([], { kind: 'info', message: 'a' })
    expect(dismissToast(toasts, 'nope')).toEqual(toasts)
  })
})
