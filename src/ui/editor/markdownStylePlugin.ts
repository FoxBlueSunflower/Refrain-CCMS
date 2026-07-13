import { syntaxTree } from '@codemirror/language'
import { RangeSet, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'

/** The literal spacer text inserted by the "Space" toolbar action (blockEditing.ts's buildSpaceInsertion) — not a genuinely blank line. */
const EMPTY_LINE_TEXT = '&nbsp;'

class EmptyLineWidget extends WidgetType {
  private readonly from: number

  constructor(from: number) {
    super()
    this.from = from
  }

  eq(other: EmptyLineWidget): boolean {
    return other.from === this.from
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rf-empty-line-placeholder'
    span.textContent = '*Empty Line*'
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: { anchor: this.from } })
      view.focus()
    })
    return span
  }
}

function touchesSelection(view: EditorView, from: number, to: number): boolean {
  const selection = view.state.selection.main
  return selection.from <= to && selection.to >= from
}

/**
 * Bold, italic, H1/H2, and blockquote all follow the same principle: only
 * the marker characters (**, *, #/##, >) are ever hidden — the styled
 * content is a non-replacing Decoration.mark/Decoration.line, so a
 * {{variable}} pill or [link](url) pill nested inside stays disjoint from
 * this plugin's own replace ranges and renders correctly underneath.
 * Tables never hide anything (styled-only, per product decision).
 */
function buildTreeDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  // Scans the whole document tree (not just view.visibleRanges) — matches
  // conditionHighlightPlugin.ts's precedent of scanning the full document
  // text, appropriate for this app's document sizes and much simpler than
  // reconciling a visible-range cursor with the ordering constraints below.
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name === 'StrongEmphasis' || node.name === 'Emphasis') {
        if (touchesSelection(view, node.from, node.to)) return false
        const open = node.node.firstChild
        const close = node.node.lastChild
        if (!open || !close || open.to >= close.from) return false
        const cls = node.name === 'StrongEmphasis' ? 'rf-bold' : 'rf-italic'
        builder.add(open.from, open.to, Decoration.replace({}))
        builder.add(open.to, close.from, Decoration.mark({ class: cls }))
        builder.add(close.from, close.to, Decoration.replace({}))
        // Doesn't descend further — a bold/italic span containing another
        // bold/italic span (e.g. "**bold *and italic***") is an edge case
        // left as one collapsed unit rather than doubly-decorated, since
        // the closing-marker replace above (positioned at the end of this
        // node) would otherwise land before a nested node's own ranges,
        // violating RangeSetBuilder's sorted-add requirement.
        return false
      }

      if (node.name === 'ATXHeading1' || node.name === 'ATXHeading2') {
        const line = doc.lineAt(node.from)
        const cls = node.name === 'ATXHeading1' ? 'rf-heading1' : 'rf-heading2'
        builder.add(line.from, line.from, Decoration.line({ class: cls }))
        const mark = node.node.firstChild
        if (mark && mark.name === 'HeaderMark' && !touchesSelection(view, line.from, line.to)) {
          const markEnd = line.text[mark.to - line.from] === ' ' ? mark.to + 1 : mark.to
          builder.add(mark.from, markEnd, Decoration.replace({}))
        }
        return true
      }

      if (node.name === 'Blockquote') {
        const active = touchesSelection(view, node.from, node.to)
        const firstLine = doc.lineAt(node.from).number
        const lastLine = doc.lineAt(node.to).number
        for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
          const line = doc.line(lineNo)
          builder.add(line.from, line.from, Decoration.line({ class: 'rf-blockquote' }))
          if (!active) {
            const match = /^\s*>\s?/.exec(line.text)
            if (match) builder.add(line.from, line.from + match[0].length, Decoration.replace({}))
          }
        }
        return true
      }

      if (node.name === 'Table') {
        const firstLine = doc.lineAt(node.from).number
        const lastLine = doc.lineAt(node.to).number
        for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
          const line = doc.line(lineNo)
          const isDelimiterRow = /^\s*\|?[\s:|-]+\|?\s*$/.test(line.text) && line.text.includes('-')
          const cls = isDelimiterRow ? 'rf-table-row rf-table-delimiter' : 'rf-table-row'
          builder.add(line.from, line.from, Decoration.line({ class: cls }))
        }
        // No further descent — table cell content stays raw, unstyled
        // beyond the row-level background band (never hidden, per product
        // decision), so there's nothing more to decorate inside.
        return false
      }

      return true
    },
  })

  return builder.finish()
}

const underlineMatcher = new MatchDecorator({
  regexp: /<u>([^\n]*?)<\/u>/g,
  decorate(add, from, to, _match, view) {
    if (touchesSelection(view, from, to)) return
    const openEnd = from + 3
    const closeStart = to - 4
    add(from, openEnd, Decoration.replace({}))
    if (closeStart > openEnd) add(openEnd, closeStart, Decoration.mark({ class: 'rf-underline' }))
    add(closeStart, to, Decoration.replace({}))
  },
})

function buildEmptyLineDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo)
    if (line.text.trim() !== EMPTY_LINE_TEXT) continue
    if (touchesSelection(view, line.from, line.to)) continue
    builder.add(line.from, line.to, Decoration.replace({ widget: new EmptyLineWidget(line.from) }))
  }
  return builder.finish()
}

function buildDecorations(view: EditorView): DecorationSet {
  return RangeSet.join([buildTreeDecorations(view), underlineMatcher.createDeco(view), buildEmptyLineDecorations(view)])
}

/**
 * Renders standard markdown source with the same pill-style
 * collapse-on-cursor-touch treatment already used for {{tokens}}/[links]/
 * :::when blocks: bold, italic, underline, H1/H2, and blockquote markers
 * hide until the cursor is on them, then reveal as plain editable text.
 * Tables get background/dimming styling only — their markup is never
 * hidden. Purely a display layer; underlying document text is untouched.
 */
export function createMarkdownStylePlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
