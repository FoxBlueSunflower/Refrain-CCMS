export interface ShortcutSpec {
  id: string
  keys: string
  description: string
  /** Letter shortcuts are suppressed while typing/in a modal; Escape, Mod+S, and ? always fire. */
  requiresNoTyping: boolean
}

export const SHORTCUTS: ShortcutSpec[] = [
  { id: 'save', keys: 'Mod+S', description: 'Save the current document', requiresNoTyping: false },
  { id: 'new-document', keys: 'N', description: 'New document', requiresNoTyping: true },
  { id: 'publish', keys: 'P', description: 'Open the Publish panel', requiresNoTyping: true },
  { id: 'history', keys: 'H', description: 'Open the History panel', requiresNoTyping: true },
  { id: 'where-used', keys: 'U', description: 'Open the Where-used panel', requiresNoTyping: true },
  { id: 'toggle-preview', keys: 'V', description: 'Toggle the preview pane', requiresNoTyping: true },
  { id: 'close', keys: 'Esc', description: 'Close the topmost panel or dialog', requiresNoTyping: false },
  { id: 'help', keys: '?', description: 'Show this shortcuts list', requiresNoTyping: false },
]

export interface KeyLikeEvent {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

export interface ShortcutContext {
  isTypingTarget: boolean
  modalOpen: boolean
}

function isMod(event: KeyLikeEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function matchShortcut(event: KeyLikeEvent, context: ShortcutContext): string | null {
  const key = event.key

  if (key === 'Escape') return 'close'
  if (isMod(event) && key.toLowerCase() === 's') return 'save'
  if (key === '?' || (event.shiftKey && key === '/')) return 'help'

  if (context.isTypingTarget || context.modalOpen || isMod(event) || event.shiftKey) return null

  switch (key.toLowerCase()) {
    case 'n':
      return 'new-document'
    case 'p':
      return 'publish'
    case 'h':
      return 'history'
    case 'u':
      return 'where-used'
    case 'v':
      return 'toggle-preview'
    default:
      return null
  }
}
