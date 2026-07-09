export type FrontmatterScalar = string | number | boolean | null

export interface ParsedDocument {
  /** Flat key → scalar map. Empty object if no frontmatter block was found. */
  frontmatter: Record<string, FrontmatterScalar>
  /**
   * The markdown body: everything after the closing `---` fence, or the
   * entire input when no (well-formed) frontmatter block was found. Never
   * truncated — on any parse failure the raw remainder is preserved here so
   * no user text is ever lost.
   */
  body: string
  /** Friendly, non-fatal messages. Empty array means a clean parse. */
  warnings: string[]
}

const FENCE = '---'

function coerceScalar(raw: string): FrontmatterScalar {
  const value = raw.trim()
  if (value === 'null') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Strips a trailing `# comment` from a raw (unquoted) value, but leaves a `#`
 * inside a quoted string alone.
 */
function stripInlineComment(raw: string): string {
  const trimmed = raw.trim()
  const first = trimmed[0]
  if (first === '"' || first === "'") {
    // Only strip a comment that appears after the matching closing quote.
    const closing = trimmed.indexOf(first, 1)
    if (closing !== -1) {
      const hashIndex = trimmed.indexOf('#', closing + 1)
      if (hashIndex !== -1) return trimmed.slice(0, hashIndex).trim()
      return trimmed
    }
  }
  const hashIndex = raw.indexOf('#')
  if (hashIndex === -1) return raw
  return raw.slice(0, hashIndex)
}

function parseLine(
  line: string,
  frontmatter: Record<string, FrontmatterScalar>,
  warnings: string[],
): void {
  const trimmed = line.trim()
  if (trimmed.length === 0) return
  if (trimmed.startsWith('#')) return

  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) {
    warnings.push(`Ignoring malformed frontmatter line: "${line}"`)
    return
  }

  const key = line.slice(0, colonIndex).trim()
  if (key.length === 0) {
    warnings.push(`Ignoring malformed frontmatter line: "${line}"`)
    return
  }

  const rawValue = stripInlineComment(line.slice(colonIndex + 1))
  frontmatter[key] = coerceScalar(rawValue)
}

/**
 * Reconstructs the substring of the original file starting at `lines[fromIndex]`
 * through the end, using the original line separators — so CRLF/LF is
 * preserved byte-for-byte rather than normalized.
 */
function reconstruct(lines: string[], separators: string[], fromIndex: number): string {
  if (fromIndex >= lines.length) return ''
  let result = lines[fromIndex]
  for (let i = fromIndex; i < lines.length - 1; i++) {
    result += separators[i] + lines[i + 1]
  }
  return result
}

/**
 * Parses the flat-scalar YAML-ish frontmatter this product uses (see
 * SPEC.md: title/description/order for documents, name/description/
 * forked_from/forked_from_snapshot for snippets). Never throws — any parse
 * failure degrades to a warning plus the original text preserved in `body`.
 */
export function parseFrontmatter(raw: string): ParsedDocument {
  const parts = raw.split(/(\r\n|\n)/)
  const lines = parts.filter((_, i) => i % 2 === 0)
  const separators = parts.filter((_, i) => i % 2 === 1)

  if (lines[0] !== FENCE) {
    return { frontmatter: {}, body: raw, warnings: [] }
  }

  const closingIndex = lines.indexOf(FENCE, 1)
  if (closingIndex === -1) {
    return {
      frontmatter: {},
      body: reconstruct(lines, separators, 1),
      warnings: ['Frontmatter is missing its closing "---" — treating the rest of the file as body.'],
    }
  }

  const frontmatter: Record<string, FrontmatterScalar> = {}
  const warnings: string[] = []
  for (const line of lines.slice(1, closingIndex)) {
    parseLine(line, frontmatter, warnings)
  }

  const body = reconstruct(lines, separators, closingIndex + 1)
  return { frontmatter, body, warnings }
}
