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

/**
 * True for hrefs that should be left to native browser navigation: scheme-qualified
 * URLs (http:, https:, mailto:, ...) and protocol-relative (//host/...) links.
 */
export function isExternalHref(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('//')
}

/**
 * Resolves a markdown `href` found inside the document at `currentRelPath`
 * (both relative to the workspace's docs/ folder) into a normalized target
 * relPath. Returns null for anything that isn't an in-workspace document
 * link the preview should intercept: external/scheme hrefs, in-page anchors,
 * absolute paths, links that normalize above docs/, or non-.md targets.
 */
export function resolveRelativeDocLink(currentRelPath: string, href: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('/') || isExternalHref(href)) return null

  const [withoutHash] = href.split('#')
  const currentDirSegments = splitPath(currentRelPath).slice(0, -1)
  const hrefSegments = splitPath(withoutHash)

  const resolved: string[] = [...currentDirSegments]
  for (const segment of hrefSegments) {
    if (segment === '.') continue
    if (segment === '..') {
      if (resolved.length === 0) return null
      resolved.pop()
      continue
    }
    resolved.push(segment)
  }

  if (resolved.length === 0) return null
  const target = resolved.join('/')
  return target.endsWith('.md') ? target : null
}
