/**
 * Pure text-transform for applying a ":::when dimension=value ... :::"
 * condition (Phase 8e) to the current editor selection. Framework-free (no
 * CodeMirror imports) so the string logic is unit-testable on its own;
 * CodeMirrorEditor.tsx wires the result into a single view.dispatch.
 */
export interface ConditionInsertion {
  insertText: string
  /** Absolute offset in the new document (relative to `from`) to place the cursor after inserting. */
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

/**
 * Builds the text to insert (replacing the current selection `[from, to)`
 * of `doc`) to apply a `:::when dimension=value` condition.
 *
 * - Empty selection: inserts a blank scaffold with the cursor left on the
 *   blank body line, ready to type.
 * - Non-empty selection: wraps the selected text in bare fence lines,
 *   adding a leading/trailing newline only when the selection doesn't
 *   already start/end at a line boundary, and a newline before the closing
 *   fence only when the selected text doesn't already end with one — so the
 *   fences always land on their own line, byte-identical to hand-typing the
 *   syntax around the same selection.
 */
export function buildConditionInsertion(doc: string, from: number, to: number, dimension: string, value: string): ConditionInsertion {
  const opening = `:::when ${dimension}=${value}`

  if (from === to) {
    const insertText = `${opening}\n\n:::\n`
    return { insertText, cursorPos: opening.length + 1 }
  }

  const selected = doc.slice(from, to)
  const leading = from === lineStart(doc, from) ? '' : '\n'
  const trailingBody = selected.endsWith('\n') ? '' : '\n'
  const trailing = to === lineEnd(doc, to) ? '' : '\n'
  const insertText = `${leading}${opening}\n${selected}${trailingBody}:::${trailing}`
  return { insertText, cursorPos: insertText.length }
}
