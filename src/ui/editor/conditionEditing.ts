/**
 * Pure text-transform for applying a ":::when dimension=value ... :::"
 * condition (Phase 8e) to the current editor selection. Framework-free (no
 * CodeMirror imports) so the string logic is unit-testable on its own;
 * CodeMirrorEditor.tsx wires the result into a single view.dispatch.
 */
import { buildFenceWrap, type TextEdit } from './textBlocks'

export type ConditionInsertion = TextEdit

/**
 * Builds the text to insert (replacing `[from, to)` of `doc`, possibly
 * widened — see buildFenceWrap's line-snapping docs) to apply a
 * `:::when dimension=value` condition.
 */
export function buildConditionInsertion(doc: string, from: number, to: number, dimension: string, value: string): ConditionInsertion {
  return buildFenceWrap(doc, from, to, `:::when ${dimension}=${value}`, ':::')
}
