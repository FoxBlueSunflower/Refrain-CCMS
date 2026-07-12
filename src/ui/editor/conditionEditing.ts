/**
 * Pure text-transform for applying a ":::when dimension=value ... :::"
 * condition (Phase 8e) to the current editor selection. Framework-free (no
 * CodeMirror imports) so the string logic is unit-testable on its own;
 * CodeMirrorEditor.tsx wires the result into a single view.dispatch.
 */
export interface ConditionInsertion {
  /** Actual replacement range in `doc` — may be wider than the input `from`/`to` (see line-snapping below). */
  from: number
  to: number
  insertText: string
  /** Offset (relative to the returned `from`) to place the cursor after inserting. */
  cursorPos: number
}

function lineStart(doc: string, pos: number): number {
  const idx = doc.lastIndexOf('\n', pos - 1)
  return idx === -1 ? 0 : idx + 1
}

function lineEnd(doc: string, pos: number): number {
  const idx = doc.indexOf('\n', pos)
  return idx === -1 ? doc.length : idx
}

/** True when `pos` already sits at a natural line break (doc start/end, or adjacent to a `\n` on either side) — i.e. nothing of the current line is left dangling on either side of it. */
function isLineBoundary(doc: string, pos: number): boolean {
  return pos === 0 || pos === doc.length || doc[pos - 1] === '\n' || doc[pos] === '\n'
}

/**
 * Builds the text to insert (replacing `[from, to)` of `doc`, possibly
 * widened — see below) to apply a `:::when dimension=value` condition.
 *
 * - Empty selection: inserts a blank scaffold with the cursor left on the
 *   blank body line, ready to type.
 * - Non-empty selection: a condition's fence lines must be bare on their own
 *   line, so wrapping only part of a line (e.g. a single selected word)
 *   would leave the rest of that line dangling outside the block on its own
 *   fragment line, fracturing what used to be one sentence/paragraph line
 *   into several. To avoid that, the wrap snaps outward to the start/end of
 *   whichever line(s) the selection touches, so the whole line moves inside
 *   the block together — nothing from it is left stranded outside. A
 *   selection that already starts/ends exactly at a line boundary is left
 *   alone (snapping is then a no-op), so wrapping an already-isolated
 *   paragraph or exact line selection behaves exactly as before.
 */
export function buildConditionInsertion(doc: string, from: number, to: number, dimension: string, value: string): ConditionInsertion {
  const opening = `:::when ${dimension}=${value}`

  if (from === to) {
    const insertText = `${opening}\n\n:::\n`
    return { from, to, insertText, cursorPos: opening.length + 1 }
  }

  const snappedFrom = isLineBoundary(doc, from) ? from : lineStart(doc, from)
  const snappedTo = isLineBoundary(doc, to) ? to : lineEnd(doc, to)

  const selected = doc.slice(snappedFrom, snappedTo)
  const leading = snappedFrom === lineStart(doc, snappedFrom) ? '' : '\n'
  const trailingBody = selected.endsWith('\n') ? '' : '\n'
  const trailing = snappedTo === lineEnd(doc, snappedTo) ? '' : '\n'
  const insertText = `${leading}${opening}\n${selected}${trailingBody}:::${trailing}`
  return { from: snappedFrom, to: snappedTo, insertText, cursorPos: insertText.length }
}
