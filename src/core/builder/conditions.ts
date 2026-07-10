import type { ConditionsFile, PublishProfile } from '../workspace/types'
import type { BuildWarning } from './types'

const OPEN_PATTERN = /^:::when\s+([A-Za-z0-9_-]+)=([A-Za-z0-9_-]+)\s*$/
const CLOSE_PATTERN = /^:::\s*$/

/** Scans forward from `fromIndex` for the next bare ":::" close fence, or -1 if none is found before EOF. */
function findCloseFence(lines: string[], fromIndex: number): number {
  for (let j = fromIndex; j < lines.length; j++) {
    if (CLOSE_PATTERN.test(lines[j].trim())) return j
  }
  return -1
}

/**
 * Whole-page frontmatter `when:` filtering (SPEC.md) is deliberately out of
 * scope for Phase 5 — only the block-level ":::when ... :::" syntax below is
 * implemented, matching the phase's acceptance criteria.
 *
 * Strips and filters ":::when dimension=value ... :::" blocks from raw file
 * text (frontmatter and body together, same scope collectRefs scans, so
 * reported line numbers match what the writer sees in the editor). A block
 * is kept only when both its dimension and value are recognized AND the
 * active profile includes that value — any unrecognized tag is excluded
 * (fail-closed) and warned about, since conditions exist to gate content out
 * of a build and a typo should never silently leak it in.
 */
export function filterConditions(
  text: string,
  filePath: string,
  profile: PublishProfile,
  conditionsFile: ConditionsFile,
): { text: string; warnings: BuildWarning[] } {
  const lines = text.split(/\r\n|\n/)
  const warnings: BuildWarning[] = []
  const output: string[] = []

  let i = 0
  while (i < lines.length) {
    const openMatch = OPEN_PATTERN.exec(lines[i].trim())
    if (!openMatch) {
      output.push(lines[i])
      i += 1
      continue
    }

    const [, dimension, value] = openMatch
    const openLine = i + 1
    const closeIndex = findCloseFence(lines, i + 1)

    if (closeIndex === -1) {
      warnings.push({
        type: 'unclosed-condition-block',
        file: filePath,
        line: openLine,
        message: `":::when ${dimension}=${value}" is never closed with a matching ":::" — the tag line was dropped and the rest of the document kept as-is.`,
      })
      i += 1
      continue
    }

    const isKnownDimension = dimension in conditionsFile
    const knownValues = isKnownDimension ? conditionsFile[dimension] : undefined
    const isKnownValue = knownValues?.includes(value) ?? false

    if (!isKnownDimension) {
      warnings.push({
        type: 'unknown-condition-dimension',
        file: filePath,
        line: openLine,
        message: `Unknown condition dimension "${dimension}" — it is not defined in conditions.json. Block excluded from the published output.`,
      })
    } else if (!isKnownValue) {
      warnings.push({
        type: 'unknown-condition-value',
        file: filePath,
        line: openLine,
        message: `Unknown value "${value}" for condition dimension "${dimension}" — it is not listed in conditions.json. Block excluded from the published output.`,
      })
    } else if ((profile[dimension] ?? []).includes(value)) {
      for (let k = i + 1; k < closeIndex; k++) output.push(lines[k])
    }
    // Recognized tag not in the active profile: excluded silently — this is ordinary profile filtering, not an error.

    i = closeIndex + 1
  }

  return { text: output.join('\n'), warnings }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * Preview-only, purely cosmetic: wraps each well-formed ":::when
 * dimension=value ... :::" block with empty leaf marker <div>s carrying the
 * tag as a data attribute, so the live preview can visually label block
 * boundaries without touching the markdown body between them — a raw HTML
 * block wrapping the body could suppress inline markdown parsing inside it,
 * so these are empty siblings, not a wrapper.
 *
 * Each marker is followed by a blank line: per CommonMark, a block-level
 * HTML tag like <div> starts its own HTML block that swallows every
 * following line verbatim (no inline markdown parsing) until a blank line
 * is reached. Without that blank line, the body between the two markers —
 * and everything after the closing marker — would get absorbed into raw,
 * unparsed HTML instead of rendering as markdown.
 *
 * Does not validate the tag against conditions.json and never filters
 * content — this never runs on the publish path; filterConditions above
 * remains the sole source of truth for what's valid and what's included in
 * a given profile. An unclosed block is left completely untouched.
 */
export function annotateConditionBlocks(body: string): string {
  const lines = body.split(/\r\n|\n/)
  const output: string[] = []

  let i = 0
  while (i < lines.length) {
    const openMatch = OPEN_PATTERN.exec(lines[i].trim())
    if (!openMatch) {
      output.push(lines[i])
      i += 1
      continue
    }

    const [, dimension, value] = openMatch
    const closeIndex = findCloseFence(lines, i + 1)
    if (closeIndex === -1) {
      output.push(lines[i])
      i += 1
      continue
    }

    output.push(`<div class="rf-condition-tag" data-when="${escapeAttr(`${dimension}=${value}`)}"></div>`, '')
    for (let k = i + 1; k < closeIndex; k++) output.push(lines[k])
    output.push('<div class="rf-condition-end"></div>', '')
    i = closeIndex + 1
  }

  return output.join('\n')
}
