import { useEffect, useRef } from 'react'
import { matchShortcut } from './shortcuts'

export interface AppShortcutHandlers {
  onSave: () => void
  onNewDocument: () => void
  onPublish: () => void
  onHistory: () => void
  onWhereUsed: () => void
  onTogglePreview: () => void
  onClose: () => void
  onHelp: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** App-wide keyboard shortcuts. `modalOpen` should reflect whether any dialog/panel is open, so letter shortcuts don't fire underneath it. */
export function useAppShortcuts(modalOpen: boolean, handlers: AppShortcutHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return

      const id = matchShortcut(event, { isTypingTarget: isTypingTarget(event.target), modalOpen })
      if (!id) return

      const current = handlersRef.current
      switch (id) {
        case 'save':
          current.onSave()
          break
        case 'new-document':
          current.onNewDocument()
          break
        case 'publish':
          current.onPublish()
          break
        case 'history':
          current.onHistory()
          break
        case 'where-used':
          current.onWhereUsed()
          break
        case 'toggle-preview':
          current.onTogglePreview()
          break
        case 'close':
          current.onClose()
          break
        case 'help':
          current.onHelp()
          break
      }
      event.preventDefault()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [modalOpen])
}
