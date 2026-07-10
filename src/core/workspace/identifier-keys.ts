/**
 * Character class shared by every identifier-like token in this app:
 * {{key}} variable names, snippet names, condition dimension/value names,
 * and publish profile names — keep these in sync.
 */
export const IDENTIFIER_CHARS = 'A-Za-z0-9_-'

const IDENTIFIER_PATTERN = new RegExp(`^[${IDENTIFIER_CHARS}]+$`)

export function isValidIdentifier(key: string): boolean {
  return IDENTIFIER_PATTERN.test(key)
}

export interface KeyCandidate {
  id: string
  key: string
}

export type IdentifierError = 'empty' | 'invalid-format' | 'duplicate'

/**
 * Validates a candidate list of (id, key) pairs — e.g. in-progress editor
 * rows — returning a map of id -> ordered error codes. Pure; the caller
 * decides how to render error text. Never mutates or drops candidates.
 */
export function validateIdentifierKeys(candidates: readonly KeyCandidate[]): Map<string, IdentifierError[]> {
  const countByTrimmedKey = new Map<string, number>()
  for (const candidate of candidates) {
    const trimmed = candidate.key.trim()
    if (trimmed) countByTrimmedKey.set(trimmed, (countByTrimmedKey.get(trimmed) ?? 0) + 1)
  }

  const errors = new Map<string, IdentifierError[]>()
  for (const candidate of candidates) {
    const trimmed = candidate.key.trim()
    const rowErrors: IdentifierError[] = []
    if (!trimmed) {
      rowErrors.push('empty')
    } else {
      if (!isValidIdentifier(trimmed)) rowErrors.push('invalid-format')
      if ((countByTrimmedKey.get(trimmed) ?? 0) > 1) rowErrors.push('duplicate')
    }
    if (rowErrors.length > 0) errors.set(candidate.id, rowErrors)
  }
  return errors
}
