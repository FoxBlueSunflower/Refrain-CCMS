import type { NestingViolation, NestingViolationType } from '../validator/nesting'
import type { BuildWarning, BuildWarningType } from './types'

const TYPE_MAP: Record<NestingViolationType, BuildWarningType> = {
  'snippet-multiline-nested': 'snippet-nested-multiline',
  'condition-nested': 'condition-nested-invalid',
  'block-breaks-table': 'block-breaks-table',
}

/** Maps validator findings onto this build pipeline's warning shape (1-indexed `line`, same convention as filterConditions' own warnings). */
export function nestingViolationsToBuildWarnings(violations: readonly NestingViolation[], file: string): BuildWarning[] {
  return violations.map((v) => ({ type: TYPE_MAP[v.type], file, line: v.line + 1, message: v.message }))
}
