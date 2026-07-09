export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function joinPath(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.split('/'))
    .filter((part) => part.length > 0)
    .join('/')
}

export function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part.length > 0)
}

const RESERVED_NAMES = new Set(['.', '..'])

export function isValidFilename(name: string): boolean {
  if (name.length === 0) return false
  if (RESERVED_NAMES.has(name)) return false
  if (name.includes('/') || name.includes('\\')) return false
  return true
}

export function withMdExtension(name: string): string {
  return name.endsWith('.md') ? name : `${name}.md`
}

/**
 * Appends -2, -3, ... to `base` until it's not present in `existing`.
 * Used for new-document filename collisions (no algorithm is specified by SPEC.md).
 */
export function uniqueSlug(base: string, existing: ReadonlySet<string>): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) {
    n += 1
  }
  return `${base}-${n}`
}
