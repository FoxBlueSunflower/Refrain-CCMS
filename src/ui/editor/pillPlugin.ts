import { EditorSelection, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { createTokenPattern } from '../../core/resolver/tokens'
import type { ResolveContext } from '../../core/resolver/types'

/** Dispatched when `resolveContext` changes externally (e.g. variables.json edited elsewhere) so open pills refresh without a doc edit. */
export const refreshPillsEffect = StateEffect.define<null>()

class VariablePillWidget extends WidgetType {
  private readonly from: number
  private readonly key: string
  private readonly value: string | undefined

  constructor(from: number, key: string, value: string | undefined) {
    super()
    this.from = from
    this.key = key
    this.value = value
  }

  eq(other: VariablePillWidget): boolean {
    return other.key === this.key && other.value === this.value
  }

  toDOM(view: EditorView): HTMLElement {
    const broken = this.value === undefined
    const span = document.createElement('span')
    span.className = broken ? 'rf-pill rf-pill-variable rf-pill-broken' : 'rf-pill rf-pill-variable'
    span.textContent = this.key
    span.title = broken ? `Variable "${this.key}" is not defined in variables.json.` : this.value
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: EditorSelection.cursor(this.from) })
      view.focus()
    })
    return span
  }
}

function createMatcher(getResolveContext: () => ResolveContext): MatchDecorator {
  return new MatchDecorator({
    regexp: createTokenPattern(),
    decorate(add, from, to, match, view) {
      if (match[1] === '>') return // {{> snippet}} refs are left plain — see Phase 8c

      const selection = view.state.selection.main
      if (selection.from <= to && selection.to >= from) return // cursor touches this token — leave it as editable raw text

      const key = match[2]
      const value = getResolveContext().variables[key]?.value
      add(from, to, Decoration.replace({ widget: new VariablePillWidget(from, key, value) }))
    },
  })
}

/**
 * Renders {{variable_name}} references as pills (Phase 8b), collapsing back
 * to raw text while the cursor is inside one so it stays editable. Purely a
 * display layer — the underlying document text is never touched.
 */
export function createVariablePillPlugin(getResolveContext: () => ResolveContext): Extension {
  const matcher = createMatcher(getResolveContext)

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view)
      }

      update(update: ViewUpdate) {
        const contextRefreshed = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshPillsEffect)))
        if (update.docChanged || update.viewportChanged || contextRefreshed) {
          this.decorations = matcher.updateDeco(update, this.decorations)
        } else if (update.selectionSet) {
          // Cursor moved with no doc/viewport change — MatchDecorator's own
          // updateDeco skips this case, but pill/raw-text visibility depends
          // on cursor position, so recompute from scratch.
          this.decorations = matcher.createDeco(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
