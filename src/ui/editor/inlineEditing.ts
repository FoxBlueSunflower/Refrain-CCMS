/**
 * Pure text-transforms for inline text-formatting toolbar actions (bold,
 * italic, underline). Framework-free (no CodeMirror imports) so the string
 * logic is unit-testable on its own; CodeMirrorEditor.tsx wires the result
 * into a single view.dispatch.
 */
import { buildInlineWrap, type TextEdit } from './textBlocks'

export type InlineInsertion = TextEdit

export type InlineAction = 'bold' | 'italic' | 'underline'

export function buildBoldInsertion(doc: string, from: number, to: number): InlineInsertion {
  return buildInlineWrap(doc, from, to, '**', '**')
}

export function buildItalicInsertion(doc: string, from: number, to: number): InlineInsertion {
  return buildInlineWrap(doc, from, to, '*', '*')
}

// CommonMark/GFM have no native underline syntax; `<u>` is passed through
// untouched by marked (used for both live preview and static-site publish),
// so raw inline HTML is the standard way to represent this.
export function buildUnderlineInsertion(doc: string, from: number, to: number): InlineInsertion {
  return buildInlineWrap(doc, from, to, '<u>', '</u>')
}

export function buildInlineInsertion(doc: string, from: number, to: number, action: InlineAction): InlineInsertion {
  switch (action) {
    case 'bold':
      return buildBoldInsertion(doc, from, to)
    case 'italic':
      return buildItalicInsertion(doc, from, to)
    case 'underline':
      return buildUnderlineInsertion(doc, from, to)
  }
}
