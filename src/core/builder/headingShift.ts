import type { BuildWarning } from './types'

const MAX_HEADING_LEVEL = 6
const HEADING_PATTERN = /^(#{1,6})(\s+.*)$/

/**
 * Shifts every ATX heading (H1-H6) in `body` by a flat offset so that the
 * document's own H1 becomes `targetLevel` (Phase 9c: a publication assigns
 * this from the doc node's tree depth) and every other heading in the doc
 * stays nested the same number of levels beneath it. Line-based, no
 * code-fence awareness — same tradeoff already accepted by conditions.ts and
 * headingCheck.ts elsewhere in this codebase.
 *
 * A shifted level over H6 clamps to H6 (never dropped, never an invalid
 * `#######`) and is reported as a `heading-level-exceeds-h6` warning with
 * the offending line number.
 */
export function shiftHeadingLevels(
  body: string,
  targetLevel: number,
  filePath: string,
): { text: string; warnings: BuildWarning[] } {
  const offset = targetLevel - 1
  const warnings: BuildWarning[] = []
  const lines = body.split(/\r\n|\n/)

  if (offset === 0) return { text: lines.join('\n'), warnings }

  const shifted = lines.map((line, index) => {
    const match = HEADING_PATTERN.exec(line)
    if (!match) return line

    const [, hashes, rest] = match
    const newLevel = hashes.length + offset
    if (newLevel > MAX_HEADING_LEVEL) {
      warnings.push({
        type: 'heading-level-exceeds-h6',
        file: filePath,
        line: index + 1,
        message: `Heading level would exceed H6 after publication nesting and was capped at H6.`,
      })
    }
    return '#'.repeat(Math.min(newLevel, MAX_HEADING_LEVEL)) + rest
  })

  return { text: shifted.join('\n'), warnings }
}
