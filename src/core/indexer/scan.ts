import { IDENTIFIER_CHARS } from '../workspace/identifier-keys'

/** Matches {{key}} and {{> name}} — the same token shape resolve.ts substitutes/transcludes. */
const TOKEN_PATTERN = new RegExp(`\\{\\{(>)?\\s*([${IDENTIFIER_CHARS}]+)\\s*\\}\\}`, 'g')

/** Matches ":::when dimension=value" fenced condition blocks. Dimensions are user-defined, not a fixed set. */
const CONDITION_PATTERN = new RegExp(`:::when\\s+([${IDENTIFIER_CHARS}]+)=([${IDENTIFIER_CHARS}]+)`, 'g')

export interface ScannedRefs {
  variables: Set<string>
  snippets: Set<string>
  conditions: Set<string>
}

/**
 * Extracts every {{key}}, {{> name}}, and :::when dimension=value reference
 * from raw file text (frontmatter and body both — a variable used only in a
 * document's `title:` line still counts as "used").
 */
export function collectRefs(text: string): ScannedRefs {
  const variables = new Set<string>()
  const snippets = new Set<string>()
  const conditions = new Set<string>()

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [, marker, key] = match
    if (marker === '>') snippets.add(key)
    else variables.add(key)
  }

  for (const match of text.matchAll(CONDITION_PATTERN)) {
    const [, dimension, value] = match
    conditions.add(`${dimension}=${value}`)
  }

  return { variables, snippets, conditions }
}
