export type FrontmatterEntryKind = 'document' | 'snippet'

export type FrontmatterFieldType = 'string' | 'number'

export interface FrontmatterFieldSchema {
  key: string
  label: string
  type: FrontmatterFieldType
}

/**
 * Known frontmatter keys per entry kind, scoped to exactly what SPEC.md
 * documents (Part 2's document/snippet examples). Deliberately excludes
 * anything not both documented and consumed today — e.g. `when` (page-level
 * condition) is SPEC-documented but has no runtime consumer yet, so it's
 * left as an ordinary custom key rather than promoted to a form field.
 */
export const FRONTMATTER_SCHEMA: Record<FrontmatterEntryKind, readonly FrontmatterFieldSchema[]> = {
  document: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'description', label: 'Description', type: 'string' },
    { key: 'order', label: 'Order', type: 'number' },
  ],
  snippet: [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'description', label: 'Description', type: 'string' },
    { key: 'forked_from', label: 'Forked from', type: 'string' },
    { key: 'forked_from_snapshot', label: 'Forked at', type: 'string' },
  ],
}

export function knownFrontmatterKeys(entryKind: FrontmatterEntryKind): readonly string[] {
  return FRONTMATTER_SCHEMA[entryKind].map((field) => field.key)
}

export function isKnownFrontmatterKey(entryKind: FrontmatterEntryKind, key: string): boolean {
  return knownFrontmatterKeys(entryKind).includes(key)
}
