import { syntaxTree } from '@codemirror/language'
import { EditorSelection, RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { parseFrontmatter } from '../../core/frontmatter/parse'
import { createTokenPattern, findTokenMatches } from '../../core/resolver/tokens'
import type { ResolveContext } from '../../core/resolver/types'
import { classifyLink, resolveRelativeDocLink, type LinkClassification } from '../../core/workspace/paths'

/** Dispatched when `resolveContext` changes externally (e.g. variables.json edited elsewhere) so open pills refresh without a doc edit. */
export const refreshPillsEffect = StateEffect.define<null>()

class VariablePillWidget extends WidgetType {
  private readonly from: number
  private readonly key: string
  private readonly value: string | undefined

  constructor(from: number, key: string, value: string | undefined) {
    super()
    this.from = from
    this.key = key
    this.value = value
  }

  eq(other: VariablePillWidget): boolean {
    return other.key === this.key && other.value === this.value
  }

  toDOM(view: EditorView): HTMLElement {
    const broken = this.value === undefined
    const span = document.createElement('span')
    span.className = broken ? 'rf-pill rf-pill-variable rf-pill-broken' : 'rf-pill rf-pill-variable'
    span.textContent = this.key
    span.title = broken ? `Variable "${this.key}" is not defined in variables.json.` : this.value
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: EditorSelection.cursor(this.from) })
      view.focus()
    })
    return span
  }
}

class SnippetPillWidget extends WidgetType {
  private readonly from: number
  private readonly name: string
  private readonly raw: string | undefined

  constructor(from: number, name: string, raw: string | undefined) {
    super()
    this.from = from
    this.name = name
    this.raw = raw
  }

  eq(other: SnippetPillWidget): boolean {
    return other.name === this.name && other.raw === this.raw
  }

  toDOM(view: EditorView): HTMLElement {
    const broken = this.raw === undefined
    const span = document.createElement('span')
    span.className = broken ? 'rf-pill rf-pill-snippet rf-pill-broken' : 'rf-pill rf-pill-snippet'
    span.textContent = `> ${this.name}`
    if (broken) {
      span.title = `Snippet "${this.name}" was not found in snippets/.`
    } else {
      const { frontmatter } = parseFrontmatter(this.raw as string)
      const description = typeof frontmatter.description === 'string' ? frontmatter.description.trim() : ''
      span.title = description.length > 0 ? description : `Snippet "${this.name}" has no description.`
    }
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: EditorSelection.cursor(this.from) })
      view.focus()
    })
    return span
  }
}

function createMatcher(getResolveContext: () => ResolveContext): MatchDecorator {
  return new MatchDecorator({
    regexp: createTokenPattern(),
    decorate(add, from, to, match, view) {
      const selection = view.state.selection.main
      if (selection.from <= to && selection.to >= from) return // cursor touches this token — leave it as editable raw text

      const key = match[2]
      if (match[1] === '>') {
        const raw = getResolveContext().snippets[key]
        add(from, to, Decoration.replace({ widget: new SnippetPillWidget(from, key, raw) }))
        return
      }

      const value = getResolveContext().variables[key]?.value
      add(from, to, Decoration.replace({ widget: new VariablePillWidget(from, key, value) }))
    },
  })
}

/**
 * Renders {{variable_name}} (Phase 8b) and {{> snippet_name}} (Phase 8c)
 * references as pills, collapsing back to raw text while the cursor is
 * inside one so it stays editable. Purely a display layer — the underlying
 * document text is never touched.
 */
export function createPillPlugin(getResolveContext: () => ResolveContext): Extension {
  const matcher = createMatcher(getResolveContext)

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view)
      }

      update(update: ViewUpdate) {
        const contextRefreshed = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshPillsEffect)))
        if (update.docChanged || update.viewportChanged || contextRefreshed) {
          this.decorations = matcher.updateDeco(update, this.decorations)
        } else if (update.selectionSet) {
          // Cursor moved with no doc/viewport change — MatchDecorator's own
          // updateDeco skips this case, but pill/raw-text visibility depends
          // on cursor position, so recompute from scratch.
          this.decorations = matcher.createDeco(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}

export interface LinkContext {
  /** Relative to the workspace's docs/ folder; null when editing a snippet (snippets have no folder position to resolve relative links against). */
  currentRelPath: string | null
  /** All known document paths, relative to docs/ (e.g. "guides/installation.md"), used to detect broken internal links. */
  documentPaths: ReadonlySet<string>
}

class LinkPillWidget extends WidgetType {
  private readonly from: number
  private readonly label: string
  private readonly tooltip: string
  private readonly classification: LinkClassification

  constructor(from: number, label: string, tooltip: string, classification: LinkClassification) {
    super()
    this.from = from
    this.label = label
    this.tooltip = tooltip
    this.classification = classification
  }

  eq(other: LinkPillWidget): boolean {
    return other.label === this.label && other.tooltip === this.tooltip && other.classification === this.classification
  }

  toDOM(view: EditorView): HTMLElement {
    const broken = this.classification === 'internal-broken' || this.classification === 'unresolvable'
    const span = document.createElement('span')
    span.className = broken ? 'rf-pill rf-pill-link rf-pill-broken' : 'rf-pill rf-pill-link'
    span.textContent = this.label
    span.title = this.tooltip
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: EditorSelection.cursor(this.from) })
      view.focus()
    })
    return span
  }
}

function linkTooltip(classification: LinkClassification, href: string, resolved: string | null): string {
  switch (classification) {
    case 'external':
    case 'anchor':
      return href
    case 'internal-ok':
      return resolved as string
    case 'internal-broken':
      return resolved !== null
        ? `Linked document "${resolved}" was not found in docs/.`
        : `This link couldn't be resolved to a document in docs/.`
    case 'unresolvable':
      return `Can't check this link from a snippet — snippets aren't located in docs/, so relative links can't be resolved.`
  }
}

/**
 * Builds link-pill decorations by walking the markdown syntax tree (not a
 * MatchDecorator regex, unlike the token pills above) — link destinations
 * can legally contain parens and link text can contain nested marks, both
 * of which a hand-rolled regex would mishandle; the markdown parser already
 * solves this correctly (it's also what backs `tags.url`/`tags.link` syntax
 * highlighting).
 */
function buildLinkDecorations(view: EditorView, getLinkContext: () => LinkContext): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { currentRelPath, documentPaths } = getLinkContext()
  const selection = view.state.selection.main
  // Tracked across all visible ranges (not reset per range) since
  // RangeSetBuilder.add() requires strictly increasing, non-overlapping
  // ranges, and syntaxTree(...).iterate() can re-enter a node that started
  // before the current range's `from` on documents with multiple disjoint
  // visible ranges.
  let lastTo = 0

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Link') return true // keep descending into non-Link nodes

        if (node.from < lastTo) return false // already covered by a previous visible range

        const linkNode = node.node
        const urlNode = linkNode.getChild('URL')
        if (!urlNode) return false // reference-style ([text][ref]) or malformed/in-progress link — leave as raw/highlighted text

        if (selection.from <= node.to && selection.to >= node.from) return false // cursor touches this link — leave it as editable raw text

        const firstMark = linkNode.firstChild
        const closeBracket = urlNode.prevSibling?.prevSibling
        if (!firstMark || !closeBracket || closeBracket.name !== 'LinkMark') return false

        const label = view.state.sliceDoc(firstMark.to, closeBracket.from)
        const href = view.state.sliceDoc(urlNode.from, urlNode.to)

        // A {{variable}}/{{> snippet}} token inside the link text or URL
        // would overlap the separate token-pill plugin's own decoration for
        // that range — yield to it rather than risk two ViewPlugins
        // producing overlapping Decoration.replace ranges.
        if (findTokenMatches(view.state.sliceDoc(node.from, node.to)).length > 0) return false

        const classification = classifyLink(href, currentRelPath, documentPaths)
        const resolved =
          classification === 'internal-ok' || classification === 'internal-broken'
            ? (currentRelPath !== null ? resolveRelativeDocLink(currentRelPath, href) : null)
            : null
        const tooltip = linkTooltip(classification, href, resolved)

        builder.add(node.from, node.to, Decoration.replace({ widget: new LinkPillWidget(node.from, label, tooltip, classification) }))
        lastTo = node.to
        return false
      },
    })
  }

  return builder.finish()
}

/**
 * Renders standard markdown [text](url) links as pills, following the same
 * collapse-to-raw-text-on-cursor-touch and broken/valid styling pattern as
 * the token pills above. Kept as a separate ViewPlugin (not merged into
 * createPillPlugin) since it's syntax-tree-based rather than MatchDecorator-
 * based — a structurally different decoration-computation model.
 */
export function createLinkPillPlugin(getLinkContext: () => LinkContext): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildLinkDecorations(view, getLinkContext)
      }

      update(update: ViewUpdate) {
        const contextRefreshed = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshPillsEffect)))
        if (update.docChanged || update.viewportChanged || update.selectionSet || contextRefreshed) {
          this.decorations = buildLinkDecorations(update.view, getLinkContext)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
