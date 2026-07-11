import { IDENTIFIER_CHARS } from '../workspace/identifier-keys'

/**
 * The one definition of what counts as a {{key}} or {{> name}} token.
 * Returns a fresh RegExp per call since `exec`/matchAll on a shared global
 * RegExp instance would carry stateful `lastIndex` across callers.
 */
export function createTokenPattern(): RegExp {
  return new RegExp(`\\{\\{(>)?\\s*([${IDENTIFIER_CHARS}]+)\\s*\\}\\}`, 'g')
}

export interface TokenMatch {
  from: number
  to: number
  kind: 'variable' | 'snippet'
  key: string
}

/** Finds every {{key}} and {{> name}} reference in `body`, in document order. */
export function findTokenMatches(body: string): TokenMatch[] {
  const pattern = createTokenPattern()
  const matches: TokenMatch[] = []
  for (const match of body.matchAll(pattern)) {
    const [full, marker, key] = match
    const from = match.index ?? 0
    matches.push({ from, to: from + full.length, kind: marker === '>' ? 'snippet' : 'variable', key })
  }
  return matches
}
