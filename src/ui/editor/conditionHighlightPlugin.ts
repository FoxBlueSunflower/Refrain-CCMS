import { EditorSelection, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { findConditionBlocks } from '../../core/builder/conditions'

/** Fixed rotating palette (see CodeMirrorEditor.tsx theme for the actual colors) — enough to keep adjacent, differently-tagged blocks visually distinct without an open-ended per-tag palette. */
const PALETTE_SIZE = 4

function colorIndexFor(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return hash % PALETTE_SIZE
}

class RemoveConditionWidget extends WidgetType {
  private readonly openLine: number
  private readonly closeLine: number
  private readonly tag: string

  constructor(openLine: number, closeLine: number, tag: string) {
    super()
    this.openLine = openLine
    this.closeLine = closeLine
    this.tag = tag
  }

  eq(other: RemoveConditionWidget): boolean {
    return other.openLine === this.openLine && other.closeLine === this.closeLine && other.tag === this.tag
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rf-condition-remove'
    span.textContent = '✕'
    span.title = 'Remove condition'
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      // Re-read current line positions at click time — safe because any doc
      // edit already triggers a full decoration recompute, so this widget
      // instance always corresponds to the document's current line layout.
      const doc = view.state.doc
      if (this.openLine + 1 > doc.lines || this.closeLine + 1 > doc.lines) return
      const openLineObj = doc.line(this.openLine + 1)
      const closeLineObj = doc.line(this.closeLine + 1)
      view.dispatch({
        changes: [
          { from: closeLineObj.from, to: Math.min(closeLineObj.to + 1, doc.length) },
          { from: openLineObj.from, to: Math.min(openLineObj.to + 1, doc.length) },
        ],
      })
      view.focus()
    })
    return span
  }
}

class ConditionTagWidget extends WidgetType {
  private readonly dimension: string
  private readonly value: string
  private readonly pos: number

  constructor(dimension: string, value: string, pos: number) {
    super()
    this.dimension = dimension
    this.value = value
    this.pos = pos
  }

  eq(other: ConditionTagWidget): boolean {
    return other.dimension === this.dimension && other.value === this.value && other.pos === this.pos
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rf-pill rf-pill-condition'
    span.textContent = `${this.dimension}=${this.value}`
    span.title = 'Click to edit condition'
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: EditorSelection.cursor(this.pos) })
      view.focus()
    })
    return span
  }
}

function buildConditionDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const selection = view.state.selection.main
  const blocks = findConditionBlocks(doc.toString())

  for (const block of blocks) {
    const tag = `${block.dimension}=${block.value}`
    const colorClass = `rf-condition-color-${colorIndexFor(tag)}`
    const openLineObj = doc.line(block.openLine + 1)
    const closeLineObj = doc.line(block.closeLine + 1)
    const isActive = selection.from <= closeLineObj.to && selection.to >= openLineObj.from

    if (isActive) {
      builder.add(
        openLineObj.from,
        openLineObj.from,
        Decoration.line({ class: `rf-condition-fence ${colorClass}`, attributes: { title: tag } }),
      )
    } else {
      builder.add(
        openLineObj.from,
        openLineObj.from,
        Decoration.line({ class: `rf-condition-body ${colorClass}`, attributes: { title: tag } }),
      )
      if (openLineObj.to > openLineObj.from) {
        builder.add(
          openLineObj.from,
          openLineObj.to,
          Decoration.replace({ widget: new ConditionTagWidget(block.dimension, block.value, openLineObj.from) }),
        )
      }
    }
    builder.add(
      openLineObj.to,
      openLineObj.to,
      Decoration.widget({ widget: new RemoveConditionWidget(block.openLine, block.closeLine, tag), side: 1 }),
    )

    for (let lineNo = block.openLine + 2; lineNo <= block.closeLine; lineNo++) {
      const lineObj = doc.line(lineNo)
      builder.add(lineObj.from, lineObj.from, Decoration.line({ class: `rf-condition-body ${colorClass}`, attributes: { title: tag } }))
    }

    if (isActive) {
      builder.add(closeLineObj.from, closeLineObj.from, Decoration.line({ class: `rf-condition-fence ${colorClass}`, attributes: { title: tag } }))
    } else {
      builder.add(closeLineObj.from, closeLineObj.from, Decoration.line({ class: `rf-condition-body ${colorClass}`, attributes: { title: tag } }))
      if (closeLineObj.to > closeLineObj.from) {
        builder.add(closeLineObj.from, closeLineObj.to, Decoration.replace({}))
      }
    }
  }

  return builder.finish()
}

/**
 * Highlights ":::when dimension=value ... :::" blocks (Phase 8e) with a
 * per-tag background tint spanning the whole block, distinguishing several
 * overlapping conditions in one document at a glance instead of leaving a
 * wall of raw ":::" markers to read. Purely a display layer — the
 * underlying document text is untouched — plus a small "✕" widget on the
 * opening fence line to remove a block cleanly (deletes both fence lines
 * and their trailing newline, leaving the body as plain text).
 *
 * The fence lines themselves collapse to a small "dimension=value" tag
 * (raw ":::when ..."/":::" text hidden) while the border/background tint
 * carries on across them uninterrupted, and expand back to raw editable
 * text only while the cursor/selection is inside the block — same
 * collapse-to-pill-until-touched interaction as pillPlugin.ts uses for
 * {{variable}}/{{> snippet}}/[link](url).
 */
export function createConditionHighlightPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildConditionDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = buildConditionDecorations(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
