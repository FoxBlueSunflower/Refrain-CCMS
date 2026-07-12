/**
 * Pure text-transform for inserting a markdown link (`[text](target)`) at
 * the current editor selection. Framework-free (no CodeMirror imports) so
 * the string logic is unit-testable on its own; CodeMirrorEditor.tsx wires
 * the result into a single view.dispatch.
 *
 * Serves both internal (doc-relative path) and external (URL) links —
 * `target` is just whatever string the caller passes in; this function
 * doesn't need to know which kind it is.
 */
import type { TextEdit } from './textBlocks'

export type LinkInsertion = TextEdit

export function buildLinkInsertion(doc: string, from: number, to: number, target: string): LinkInsertion {
  const selected = doc.slice(from, to)
  if (selected.length > 0) {
    const insertText = `[${selected}](${target})`
    return { from, to, insertText, cursorPos: insertText.length }
  }
  const insertText = `[](${target})`
  return { from, to, insertText, cursorPos: 1 }
}
