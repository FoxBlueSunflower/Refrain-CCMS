import { describe, expect, it } from 'vitest'
import { matchShortcut, SHORTCUTS } from './shortcuts'

const notTyping = { isTypingTarget: false, modalOpen: false }
const typing = { isTypingTarget: true, modalOpen: false }
const modalOpen = { isTypingTarget: false, modalOpen: true }

function key(k: string, opts: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) {
  return { key: k, metaKey: false, ctrlKey: false, shiftKey: false, ...opts }
}

describe('matchShortcut', () => {
  it('fires letter shortcuts from a neutral focus state', () => {
    expect(matchShortcut(key('n'), notTyping)).toBe('new-document')
    expect(matchShortcut(key('p'), notTyping)).toBe('publish')
    expect(matchShortcut(key('h'), notTyping)).toBe('history')
    expect(matchShortcut(key('u'), notTyping)).toBe('where-used')
    expect(matchShortcut(key('v'), notTyping)).toBe('toggle-preview')
  })

  it('matches letters case-insensitively', () => {
    expect(matchShortcut(key('N'), notTyping)).toBe('new-document')
  })

  it('suppresses letter shortcuts while typing', () => {
    expect(matchShortcut(key('n'), typing)).toBeNull()
  })

  it('suppresses letter shortcuts while a modal is open', () => {
    expect(matchShortcut(key('n'), modalOpen)).toBeNull()
  })

  it('still fires Escape while typing', () => {
    expect(matchShortcut(key('Escape'), typing)).toBe('close')
  })

  it('still fires Mod+S while typing', () => {
    expect(matchShortcut(key('s', { metaKey: true }), typing)).toBe('save')
    expect(matchShortcut(key('s', { ctrlKey: true }), typing)).toBe('save')
  })

  it('still fires ? while typing', () => {
    expect(matchShortcut(key('?'), typing)).toBe('help')
    expect(matchShortcut(key('/', { shiftKey: true }), typing)).toBe('help')
  })

  it('does not treat a bare letter with a modifier as a letter shortcut', () => {
    expect(matchShortcut(key('n', { metaKey: true }), notTyping)).toBeNull()
  })

  it('returns null for unrelated keys', () => {
    expect(matchShortcut(key('x'), notTyping)).toBeNull()
  })

  it('keeps SHORTCUTS and matchShortcut in sync for every documented id', () => {
    const ids = new Set(SHORTCUTS.map((s) => s.id))
    expect(ids).toEqual(
      new Set(['save', 'new-document', 'publish', 'history', 'where-used', 'toggle-preview', 'close', 'help']),
    )
  })
})
