/**
 * Pure text-transforms for the Phase 8f block-insertion toolbar (bulleted
 * list, numbered list, blockquote, code block, horizontal rule).
 * Framework-free (no CodeMirror imports) so the string logic is
 * unit-testable on its own; CodeMirrorEditor.tsx wires the result into a
 * single view.dispatch.
 */
import { buildFenceWrap, lineEnd, lineStart, type TextEdit } from './textBlocks'

export type BlockInsertion = TextEdit

export type BlockAction =
  | 'bullet-list'
  | 'numbered-list'
  | 'checklist'
  | 'blockquote'
  | 'code-block'
  | 'horizontal-rule'
  | 'table'
  | 'subheading'

/** Prefixes every line touched by `[from, to)` (snapped outward to whole lines) with `makePrefix(lineIndex)`. */
function applyLinePrefix(doc: string, from: number, to: number, makePrefix: (lineIndex: number) => string): BlockInsertion {
  const snappedFrom = lineStart(doc, from)
  const snappedTo = lineEnd(doc, to)
  const selected = doc.slice(snappedFrom, snappedTo)
  const lines = selected.split('\n')
  const insertText = lines.map((line, i) => `${makePrefix(i)}${line}`).join('\n')
  return { from: snappedFrom, to: snappedTo, insertText, cursorPos: insertText.length }
}

export function buildBulletListInsertion(doc: string, from: number, to: number): BlockInsertion {
  return applyLinePrefix(doc, from, to, () => '- ')
}

export function buildNumberedListInsertion(doc: string, from: number, to: number): BlockInsertion {
  return applyLinePrefix(doc, from, to, (i) => `${i + 1}. `)
}

export function buildChecklistInsertion(doc: string, from: number, to: number): BlockInsertion {
  return applyLinePrefix(doc, from, to, () => '- [ ] ')
}

/**
 * Prefixes only the single line containing `from` with a level-2 heading
 * marker (`to` is ignored — a heading action promoting several lines to
 * "## " each doesn't make sense). H1 is deliberately not offered here: it's
 * reserved for the doc-title rule planned in BUILD_PLAN.md Phase 9a.
 */
export function buildSubheadingInsertion(doc: string, from: number): BlockInsertion {
  const snappedFrom = lineStart(doc, from)
  const snappedTo = lineEnd(doc, from)
  const insertText = `## ${doc.slice(snappedFrom, snappedTo)}`
  return { from: snappedFrom, to: snappedTo, insertText, cursorPos: insertText.length }
}

/**
 * Inserts a fixed 2-column GFM table template at `from`, discarding any
 * selected text. Reuses the same blank-line-padding logic as
 * `buildHorizontalRuleInsertion` so the table doesn't merge into an
 * adjacent paragraph line.
 */
export function buildTableInsertion(doc: string, from: number, to: number): BlockInsertion {
  const template = ['| Column 1 | Column 2 |', '| --- | --- |', '| Cell 1 | Cell 2 |'].join('\n')
  const before = doc.slice(0, from)
  const leading = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const after = doc.slice(to)
  const trailing = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const insertText = `${leading}${template}${trailing}`
  return { from, to, insertText, cursorPos: insertText.length }
}

export function buildBlockquoteInsertion(doc: string, from: number, to: number): BlockInsertion {
  return applyLinePrefix(doc, from, to, () => '> ')
}

export function buildCodeBlockInsertion(doc: string, from: number, to: number): BlockInsertion {
  return buildFenceWrap(doc, from, to, '```', '```')
}

/**
 * Inserts a thematic break (`---`) at `from`, discarding any selected text.
 * A `---` line adjacent to a preceding paragraph line (no blank line
 * between) is parsed by CommonMark as a Setext heading underline for that
 * paragraph, not a horizontal rule — so this always pads with a blank line
 * on both sides unless one already exists or the rule sits at a document
 * boundary.
 */
export function buildHorizontalRuleInsertion(doc: string, from: number, to: number): BlockInsertion {
  const before = doc.slice(0, from)
  const leading = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const after = doc.slice(to)
  const trailing = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const insertText = `${leading}---${trailing}`
  return { from, to, insertText, cursorPos: insertText.length }
}

export function buildBlockInsertion(doc: string, from: number, to: number, action: BlockAction): BlockInsertion {
  switch (action) {
    case 'bullet-list':
      return buildBulletListInsertion(doc, from, to)
    case 'numbered-list':
      return buildNumberedListInsertion(doc, from, to)
    case 'checklist':
      return buildChecklistInsertion(doc, from, to)
    case 'blockquote':
      return buildBlockquoteInsertion(doc, from, to)
    case 'code-block':
      return buildCodeBlockInsertion(doc, from, to)
    case 'horizontal-rule':
      return buildHorizontalRuleInsertion(doc, from, to)
    case 'table':
      return buildTableInsertion(doc, from, to)
    case 'subheading':
      return buildSubheadingInsertion(doc, from)
  }
}
