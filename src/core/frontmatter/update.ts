const FENCE = '---'

function formatScalar(value: number | string | null): string {
  if (value === null) return 'null'
  if (typeof value === 'number') return String(value)

  const needsQuoting =
    value === '' ||
    value === 'null' ||
    value === 'true' ||
    value === 'false' ||
    /^-?\d+(\.\d+)?$/.test(value) ||
    /[:#]/.test(value) ||
    value !== value.trim()

  return needsQuoting ? `'${value.replace(/'/g, "''")}'` : value
}

function reconstruct(lines: string[], separators: string[]): string {
  let result = lines[0] ?? ''
  for (let i = 0; i < lines.length - 1; i++) {
    result += (separators[i] ?? '\n') + lines[i + 1]
  }
  return result
}

/**
 * Sets (or inserts) a single scalar frontmatter key in `raw`, leaving every
 * other line — including inline comments on other keys and CRLF/LF line
 * endings — byte-for-byte untouched. Falls back to prepending a new
 * frontmatter block around the untouched original content when no
 * well-formed block exists (fail-soft, per parseFrontmatter's own
 * philosophy — never throws, never drops body text).
 */
export function setFrontmatterField(raw: string, key: string, value: number | string | null): string {
  const parts = raw.split(/(\r\n|\n)/)
  const lines = parts.filter((_, i) => i % 2 === 0)
  const separators = parts.filter((_, i) => i % 2 === 1)
  const eol = separators[0] ?? '\n'
  const formatted = formatScalar(value)

  if (lines[0] === FENCE) {
    const closingIndex = lines.indexOf(FENCE, 1)
    if (closingIndex !== -1) {
      let found = false
      for (let i = 1; i < closingIndex; i++) {
        const colonIndex = lines[i].indexOf(':')
        if (colonIndex === -1) continue
        if (lines[i].slice(0, colonIndex).trim() === key) {
          lines[i] = `${key}: ${formatted}`
          found = true
          break
        }
      }
      if (!found) {
        lines.splice(closingIndex, 0, `${key}: ${formatted}`)
        separators.splice(closingIndex - 1, 0, eol)
      }
      return reconstruct(lines, separators)
    }
  }

  return `${FENCE}${eol}${key}: ${formatted}${eol}${FENCE}${eol}${eol}${raw}`
}
