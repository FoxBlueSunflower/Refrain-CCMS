const FENCE_MARKER = /^(`{3,}|~{3,})/

/**
 * Marks every line that is either a fenced-code-block marker line or sits
 * inside one, so callers (token substitution, condition filtering, nesting
 * validation) can treat that content as fully literal — a writer showing
 * this app's own `{{key}}`/`{{> name}}`/`:::when` syntax as an example
 * inside a ``` block should see it rendered verbatim, not processed.
 *
 * Simplified relative to full CommonMark fence matching (doesn't track
 * indentation-relative fence closing, info strings, etc.) but matches this
 * codebase's existing line-scanning precedent (src/core/builder/conditions.ts).
 */
export function computeFencedLines(lines: readonly string[]): boolean[] {
  const result: boolean[] = new Array(lines.length).fill(false)
  let fenceChar: string | null = null
  let fenceLen = 0

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()

    if (fenceChar === null) {
      const openMatch = FENCE_MARKER.exec(trimmed)
      if (openMatch) {
        fenceChar = openMatch[1][0]
        fenceLen = openMatch[1].length
        result[i] = true
      }
      continue
    }

    result[i] = true
    const closeChar = fenceChar === '`' ? '`' : '~'
    const closeMatch = new RegExp(`^\\${closeChar}{${fenceLen},}\\s*$`).exec(trimmed)
    if (closeMatch) fenceChar = null
  }

  return result
}
