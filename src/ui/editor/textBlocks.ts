/**
 * Shared line/fence text-transform helpers for editor toolbar actions
 * (Phase 8e conditions, Phase 8f block markdown). Framework-free (no
 * CodeMirror imports) so the string logic is unit-testable on its own;
 * CodeMirrorEditor.tsx wires results into a single view.dispatch.
 */
export interface TextEdit {
  /** Actual replacement range in `doc` — may be wider than the input `from`/`to` (see line-snapping below). */
  from: number
  to: number
  insertText: string
  /** Offset (relative to the returned `from`) to place the cursor after inserting. */
  cursorPos: number
}

export function lineStart(doc: string, pos: number): number {
  const idx = doc.lastIndexOf('\n', pos - 1)
  return idx === -1 ? 0 : idx + 1
}

export function lineEnd(doc: string, pos: number): number {
  const idx = doc.indexOf('\n', pos)
  return idx === -1 ? doc.length : idx
}

/** True when `pos` already sits at a natural line break (doc start/end, or adjacent to a `\n` on either side) — i.e. nothing of the current line is left dangling on either side of it. */
export function isLineBoundary(doc: string, pos: number): boolean {
  return pos === 0 || pos === doc.length || doc[pos - 1] === '\n' || doc[pos] === '\n'
}

/**
 * Wraps `[from, to)` of `doc` between bare `opening`/`closing` fence lines
 * (used for ":::when" condition blocks and fenced code blocks).
 *
 * - Empty selection: inserts a blank scaffold with the cursor left on the
 *   blank body line, ready to type.
 * - Non-empty selection: a fence's opening/closing lines must be bare on
 *   their own line, so wrapping only part of a line (e.g. a single selected
 *   word) would leave the rest of that line dangling outside the block on
 *   its own fragment line, fracturing what used to be one sentence/paragraph
 *   line into several. To avoid that, the wrap snaps outward to the
 *   start/end of whichever line(s) the selection touches, so the whole line
 *   moves inside the block together — nothing from it is left stranded
 *   outside. A selection that already starts/ends exactly at a line
 *   boundary is left alone (snapping is then a no-op).
 */
export function buildFenceWrap(doc: string, from: number, to: number, opening: string, closing: string): TextEdit {
  if (from === to) {
    const insertText = `${opening}\n\n${closing}\n`
    return { from, to, insertText, cursorPos: opening.length + 1 }
  }

  const snappedFrom = isLineBoundary(doc, from) ? from : lineStart(doc, from)
  const snappedTo = isLineBoundary(doc, to) ? to : lineEnd(doc, to)

  const selected = doc.slice(snappedFrom, snappedTo)
  const leading = snappedFrom === lineStart(doc, snappedFrom) ? '' : '\n'
  const trailingBody = selected.endsWith('\n') ? '' : '\n'
  const trailing = snappedTo === lineEnd(doc, snappedTo) ? '' : '\n'
  const insertText = `${leading}${opening}\n${selected}${trailingBody}${closing}${trailing}`
  return { from: snappedFrom, to: snappedTo, insertText, cursorPos: insertText.length }
}

/**
 * Wraps `[from, to)` of `doc` inline between bare `prefix`/`suffix` markers
 * (used for bold/italic/underline). Unlike `buildFenceWrap`, this never
 * snaps to line boundaries — inline markers can sit mid-line.
 *
 * - Empty selection: inserts the bare markers with the cursor left between
 *   them, ready to type.
 * - Non-empty selection: wraps it in place, cursor after the closing marker.
 */
export function buildInlineWrap(doc: string, from: number, to: number, prefix: string, suffix: string): TextEdit {
  const selected = doc.slice(from, to)
  const insertText = `${prefix}${selected}${suffix}`
  const cursorPos = selected.length > 0 ? insertText.length : prefix.length
  return { from, to, insertText, cursorPos }
}
