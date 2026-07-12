import type { FrontmatterScalar } from './parse'

const H1_PATTERN = /^#\s+(.+?)\s*$/

/**
 * Phase 9a: every document should carry exactly one H1, matching its
 * frontmatter title, so publications (Phase 9c) have an unambiguous node
 * label to hang the tree on. Friendly warnings only — never blocks a save
 * or a publish. Snippets have no title field and are exempt (caller decides
 * whether to call this at all).
 *
 * Scans line-by-line for ATX `# ` headings only, with no code-fence
 * awareness — consistent with how this codebase already treats other
 * line-based markdown constructs (see filterConditions in
 * src/core/builder/conditions.ts). Setext-style H1 (`Title\n===`) is out of
 * scope: the editor's toolbar never emits it.
 */
export function checkHeadingNormalization(body: string, title: FrontmatterScalar | undefined): string[] {
  const lines = body.split(/\r\n|\n/)
  const h1Texts = lines
    .map((line) => H1_PATTERN.exec(line)?.[1])
    .filter((text): text is string => text !== undefined)

  if (h1Texts.length === 0) {
    return ['Add a single H1 heading (# Title) — Phase 9 publications use it as this document\'s title.']
  }
  if (h1Texts.length > 1) {
    return ['Multiple H1 headings found — a document should have exactly one (its title).']
  }
  if (typeof title === 'string' && title.length > 0 && h1Texts[0] !== title) {
    return ["The H1 heading doesn't match the frontmatter title."]
  }
  return []
}
