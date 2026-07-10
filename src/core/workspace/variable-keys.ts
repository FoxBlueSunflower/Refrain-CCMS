/** Character class shared with the resolver's {{key}} token pattern — keep these in sync. */
export const VARIABLE_KEY_CHARS = 'A-Za-z0-9_-'

const VARIABLE_KEY_PATTERN = new RegExp(`^[${VARIABLE_KEY_CHARS}]+$`)

export function isValidVariableKey(key: string): boolean {
  return VARIABLE_KEY_PATTERN.test(key)
}

export interface KeyCandidate {
  id: string
  key: string
}

export type VariableKeyError = 'empty' | 'invalid-format' | 'duplicate'

/**
 * Validates a candidate list of (id, key) pairs — e.g. in-progress editor
 * rows — returning a map of id -> ordered error codes. Pure; the caller
 * decides how to render error text. Never mutates or drops candidates.
 */
export function validateVariableKeys(candidates: readonly KeyCandidate[]): Map<string, VariableKeyError[]> {
  const countByTrimmedKey = new Map<string, number>()
  for (const candidate of candidates) {
    const trimmed = candidate.key.trim()
    if (trimmed) countByTrimmedKey.set(trimmed, (countByTrimmedKey.get(trimmed) ?? 0) + 1)
  }

  const errors = new Map<string, VariableKeyError[]>()
  for (const candidate of candidates) {
    const trimmed = candidate.key.trim()
    const rowErrors: VariableKeyError[] = []
    if (!trimmed) {
      rowErrors.push('empty')
    } else {
      if (!isValidVariableKey(trimmed)) rowErrors.push('invalid-format')
      if ((countByTrimmedKey.get(trimmed) ?? 0) > 1) rowErrors.push('duplicate')
    }
    if (rowErrors.length > 0) errors.set(candidate.id, rowErrors)
  }
  return errors
}
