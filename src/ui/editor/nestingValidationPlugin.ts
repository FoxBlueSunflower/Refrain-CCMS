import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { findNestingViolations } from '../../core/validator/nesting'
import type { ResolveContext } from '../../core/resolver/types'
import { refreshPillsEffect } from './pillPlugin'

function buildNestingDecorations(view: EditorView, getResolveContext: () => ResolveContext): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const violations = findNestingViolations(doc.toString(), getResolveContext())
  const sorted = [...violations].sort((a, b) => a.from - b.from)

  let lastTo = 0
  for (const violation of sorted) {
    if (violation.to <= violation.from || violation.from < lastTo) continue // skip empty or overlapping ranges — RangeSetBuilder requires strictly increasing, non-overlapping additions
    builder.add(violation.from, violation.to, Decoration.mark({ class: 'rf-nesting-error', attributes: { title: violation.message } }))
    lastTo = violation.to
  }

  return builder.finish()
}

/**
 * Highlights disallowed nesting (a condition block inside a table
 * cell/blockquote/list item/another condition/a snippet, a multi-line
 * snippet spliced into a table cell/blockquote/list item, or a block-start
 * construct wedged into the middle of a table) with a red wavy underline
 * and an explanatory hover tooltip. Uses `Decoration.mark`, not
 * `Decoration.replace` — unlike the pill widgets, this is an error state on
 * raw text that must stay visible and editable, not a collapsed token.
 * Recomputed on doc changes and on `refreshPillsEffect` (findNestingViolations
 * depends on resolveContext.snippets, same live-lookup dependency as the pills).
 */
export function createNestingValidationPlugin(getResolveContext: () => ResolveContext): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildNestingDecorations(view, getResolveContext)
      }

      update(update: ViewUpdate) {
        const contextRefreshed = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshPillsEffect)))
        if (update.docChanged || contextRefreshed) {
          this.decorations = buildNestingDecorations(update.view, getResolveContext)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
