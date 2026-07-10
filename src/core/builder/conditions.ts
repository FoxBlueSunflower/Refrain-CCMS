import { CONDITION_DIMENSIONS } from '../workspace/constants'
import type { ConditionsFile, PublishProfile } from '../workspace/types'
import type { BuildWarning } from './types'

const OPEN_PATTERN = /^:::when\s+([A-Za-z0-9_-]+)=([A-Za-z0-9_-]+)\s*$/
const CLOSE_PATTERN = /^:::\s*$/

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

    let closeIndex = -1
    for (let j = i + 1; j < lines.length; j++) {
      if (CLOSE_PATTERN.test(lines[j].trim())) {
        closeIndex = j
        break
      }
    }

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

    const isKnownDimension = (CONDITION_DIMENSIONS as readonly string[]).includes(dimension)
    const knownValues = isKnownDimension ? conditionsFile[dimension as keyof ConditionsFile] : undefined
    const isKnownValue = knownValues?.includes(value) ?? false

    if (!isKnownDimension) {
      warnings.push({
        type: 'unknown-condition-dimension',
        file: filePath,
        line: openLine,
        message: `Unknown condition dimension "${dimension}" — only "audience" and "output" are supported. Block excluded from the published output.`,
      })
    } else if (!isKnownValue) {
      warnings.push({
        type: 'unknown-condition-value',
        file: filePath,
        line: openLine,
        message: `Unknown value "${value}" for condition dimension "${dimension}" — it is not listed in conditions.json. Block excluded from the published output.`,
      })
    } else if (profile[dimension as keyof PublishProfile].includes(value)) {
      for (let k = i + 1; k < closeIndex; k++) output.push(lines[k])
    }
    // Recognized tag not in the active profile: excluded silently — this is ordinary profile filtering, not an error.

    i = closeIndex + 1
  }

  return { text: output.join('\n'), warnings }
}
