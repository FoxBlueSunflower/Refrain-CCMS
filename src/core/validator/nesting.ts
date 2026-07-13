import { computeFencedLines } from '../markdown/fences'
import { parseFrontmatter } from '../frontmatter/parse'
import { findConditionBlocks } from '../builder/conditions'
import { findTokenMatches } from '../resolver/tokens'
import type { ResolveContext } from '../resolver/types'

export type NestingViolationType = 'snippet-multiline-nested' | 'condition-nested' | 'block-breaks-table'

export type NestingContext = 'table-cell' | 'table-row' | 'blockquote' | 'list-item' | 'condition-block' | 'snippet'

export interface NestingViolation {
  type: NestingViolationType
  context: NestingContext
  /** 0-based line index the violation is anchored to. */
  line: number
  /** Absolute character offsets into the scanned body, for editor highlighting. */
  from: number
  to: number
  message: string
}

const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_DELIMITER = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/
const BLOCKQUOTE_PREFIX = /^\s*>\s?/
const LIST_MARKER = /^\s*(?:[-*+]|\d+\.)\s+/
const FENCE_MARKER_LINE = /^\s*(`{3,}|~{3,})/
const HEADING_LINE = /^\s*#{1,6}\s/
const HR_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const CONDITION_OPEN = /^:::when\s+([A-Za-z0-9_-]+)=([A-Za-z0-9_-]+)\s*$/
const CONDITION_CLOSE = /^:::\s*$/

const CONTEXT_LABEL: Record<NestingContext, string> = {
  'table-cell': 'table cell',
  'table-row': 'table row',
  blockquote: 'blockquote',
  'list-item': 'list item',
  'condition-block': 'condition block',
  snippet: 'snippet',
}

function lineOffsets(lines: readonly string[]): number[] {
  const offsets: number[] = [0]
  let acc = 0
  for (let i = 0; i < lines.length - 1; i++) {
    acc += lines[i].length + 1
    offsets.push(acc)
  }
  return offsets
}

/** Classifies a line's shape for the purposes of "what container is this content inside" — the innermost of a blockquote/list/table-row prefix, checked in that priority order since a table row is the most restrictive context. */
function classifyLine(line: string): NestingContext | null {
  if (TABLE_ROW.test(line)) return 'table-cell'
  if (BLOCKQUOTE_PREFIX.test(line)) return 'blockquote'
  if (LIST_MARKER.test(line)) return 'list-item'
  return null
}

/** Strips a single layer of blockquote/list prefix, if present, to test the fence pattern against what's left. */
function stripOuterPrefix(line: string): string | null {
  const bqMatch = BLOCKQUOTE_PREFIX.exec(line)
  if (bqMatch) return line.slice(bqMatch[0].length)
  const listMatch = LIST_MARKER.exec(line)
  if (listMatch) return line.slice(listMatch[0].length)
  return null
}

function findCloseFence(lines: readonly string[], fromIndex: number): number {
  for (let j = fromIndex; j < lines.length; j++) {
    if (CONDITION_CLOSE.test(lines[j].trim())) return j
  }
  return -1
}

function blockStartKind(line: string): string | null {
  const trimmed = line.trim()
  if (CONDITION_OPEN.test(trimmed) || CONDITION_CLOSE.test(trimmed)) return 'a condition block'
  if (FENCE_MARKER_LINE.test(line)) return 'a code block'
  if (LIST_MARKER.test(line)) return 'a list'
  if (BLOCKQUOTE_PREFIX.test(line)) return 'a blockquote'
  if (HEADING_LINE.test(line)) return 'a heading'
  if (HR_LINE.test(line)) return 'a horizontal rule'
  return null
}

/**
 * Finds every disallowed nesting combination in `body`: a multi-line snippet
 * spliced into a table cell/blockquote/list-item (single-line snippets are
 * fine there), a condition block nested inside a table cell/blockquote/
 * list-item/another condition/a snippet's own source, or any block-start
 * construct (list, blockquote, fence, condition, heading, hr) wedged into
 * the middle of an otherwise-contiguous table.
 */
export function findNestingViolations(body: string, ctx: ResolveContext): NestingViolation[] {
  const violations: NestingViolation[] = []
  const lines = body.split(/\r\n|\n/)
  const offsets = lineOffsets(lines)
  const fenced = computeFencedLines(lines)

  // --- Snippet single-line check ---
  for (const match of findTokenMatches(body)) {
    if (match.kind !== 'snippet') continue
    const line = lines.findIndex((_, idx) => offsets[idx] <= match.from && match.from < offsets[idx] + lines[idx].length + 1)
    if (line === -1 || fenced[line]) continue

    const context = classifyLine(lines[line])
    if (context === null) continue

    const raw = ctx.snippets[match.key]
    if (raw === undefined) continue // missing-snippet is the resolver's concern, not ours

    const { body: snippetBody } = parseFrontmatter(raw)
    const trimmed = snippetBody.trim()
    if (!/\r?\n/.test(trimmed)) continue // single-line content is fine everywhere

    violations.push({
      type: 'snippet-multiline-nested',
      context,
      line,
      from: match.from,
      to: match.to,
      message: `Snippet "${match.key}" contains multiple lines and can't be used inside a ${CONTEXT_LABEL[context]} — only single-line snippets can be nested here.`,
    })
  }

  // --- Condition nested inside a table cell / blockquote / list-item (permissive, prefix-tolerant scan) ---
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue
    const line = lines[i]
    const trimmed = line.trim()
    if (CONDITION_OPEN.test(trimmed) || CONDITION_CLOSE.test(trimmed)) continue // genuine top-level fence, not nested

    const stripped = stripOuterPrefix(line)
    if (stripped !== null && (CONDITION_OPEN.test(stripped.trim()) || CONDITION_CLOSE.test(stripped.trim()))) {
      const context = classifyLine(line) as NestingContext
      violations.push({
        type: 'condition-nested',
        context,
        line: i,
        from: offsets[i],
        to: offsets[i] + line.length,
        message: `Conditions can't be nested inside a ${CONTEXT_LABEL[context]} — move it outside, or condition the variables/snippets used inside it instead.`,
      })
      continue
    }

    if (TABLE_ROW.test(line) && /:::when\s+[A-Za-z0-9_-]+=[A-Za-z0-9_-]+/.test(line)) {
      violations.push({
        type: 'condition-nested',
        context: 'table-cell',
        line: i,
        from: offsets[i],
        to: offsets[i] + line.length,
        message: `Conditions can't be nested inside a ${CONTEXT_LABEL['table-cell']} — move it outside, or condition the variables/snippets used inside it instead.`,
      })
    }
  }

  // --- Condition-in-condition and condition-wraps-a-table-row (genuine top-level fences only) ---
  const topLevelBlocks = findConditionBlocks(body)
  for (const block of topLevelBlocks) {
    const bodyLines = lines.slice(block.openLine + 1, block.closeLine)
    const nestedOpenIndex = bodyLines.findIndex((l) => CONDITION_OPEN.test(l.trim()))
    if (nestedOpenIndex !== -1) {
      const absoluteLine = block.openLine + 1 + nestedOpenIndex
      violations.push({
        type: 'condition-nested',
        context: 'condition-block',
        line: absoluteLine,
        from: offsets[absoluteLine],
        to: offsets[absoluteLine] + lines[absoluteLine].length,
        message: `Conditions can't be nested inside a ${CONTEXT_LABEL['condition-block']} — move it outside, or condition the variables/snippets used inside it instead.`,
      })
    }

    if (bodyLines.length > 0 && bodyLines.every((l) => TABLE_ROW.test(l))) {
      const before = lines[block.openLine - 1]
      const after = lines[block.closeLine + 1]
      const wrapsTableRow = (before !== undefined && TABLE_ROW.test(before)) || (after !== undefined && TABLE_ROW.test(after))
      if (wrapsTableRow) {
        violations.push({
          type: 'condition-nested',
          context: 'table-row',
          line: block.openLine,
          from: offsets[block.openLine],
          to: offsets[block.openLine] + lines[block.openLine].length,
          message: `Conditions can't wrap a single table row — apply the condition to the whole table, or use conditional variables/snippets within cells.`,
        })
      }
    }
  }

  // --- Snippet embeds a condition in its own source (never filtered on transclusion) ---
  const checkedSnippets = new Set<string>()
  for (const match of findTokenMatches(body)) {
    if (match.kind !== 'snippet' || checkedSnippets.has(match.key)) continue
    checkedSnippets.add(match.key)
    const raw = ctx.snippets[match.key]
    if (raw === undefined) continue
    const { body: snippetBody } = parseFrontmatter(raw)
    const snippetLines = snippetBody.split(/\r\n|\n/)
    const hasCondition = snippetLines.some((l) => CONDITION_OPEN.test(l.trim()) || CONDITION_CLOSE.test(l.trim()))
    if (hasCondition) {
      violations.push({
        type: 'condition-nested',
        context: 'snippet',
        line: 0,
        from: match.from,
        to: match.to,
        message: `Snippet "${match.key}" contains a condition block — conditions inside a snippet are never filtered when the snippet is transcluded. Move the condition into the including document instead.`,
      })
    }
  }

  // --- Generic table-integrity check: a block-start line wedged into a contiguous table ---
  let i = 0
  while (i < lines.length) {
    if (fenced[i]) {
      i++
      continue
    }
    const isHeaderRow = TABLE_ROW.test(lines[i]) && !TABLE_DELIMITER.test(lines[i])
    const nextIsDelimiter = i + 1 < lines.length && !fenced[i + 1] && TABLE_ROW.test(lines[i + 1]) && TABLE_DELIMITER.test(lines[i + 1])
    if (!isHeaderRow || !nextIsDelimiter) {
      i++
      continue
    }

    let j = i + 2
    while (j < lines.length && !fenced[j] && TABLE_ROW.test(lines[j])) j++

    if (j < lines.length && lines[j].trim() !== '') {
      const kind = blockStartKind(lines[j])
      if (kind !== null) {
        let resumeAt = j + 1
        if (CONDITION_OPEN.test(lines[j].trim())) {
          const closeIndex = findCloseFence(lines, j + 1)
          resumeAt = closeIndex === -1 ? j + 1 : closeIndex + 1
        } else if (FENCE_MARKER_LINE.test(lines[j])) {
          let k = j + 1
          while (k < lines.length && !FENCE_MARKER_LINE.test(lines[k])) k++
          resumeAt = k + 1
        }
        if (resumeAt < lines.length && !fenced[resumeAt] && TABLE_ROW.test(lines[resumeAt])) {
          violations.push({
            type: 'block-breaks-table',
            context: 'table-row',
            line: j,
            from: offsets[j],
            to: offsets[j] + lines[j].length,
            message: `${kind[0].toUpperCase()}${kind.slice(1)} can't be inserted in the middle of a table — it splits the table into two pieces.`,
          })
        }
      }
    }

    i = j
  }

  return violations
}
