import { setFrontmatterField } from '../frontmatter/update'
import type { FrontmatterEntryKind } from '../frontmatter/schema'
import { DOCS_DIR, SNIPPETS_DIR, TEMPLATES_DIR, TEMPLATE_ARCHIVED_SUBDIR } from './constants'
import { slugify, splitPath } from './paths'

/** Where templates of `entryKind` live, relative to the workspace root. */
export function templateBaseDir(entryKind: FrontmatterEntryKind): string {
  return `${TEMPLATES_DIR}/${entryKind === 'document' ? DOCS_DIR : SNIPPETS_DIR}`
}

/**
 * Default placeholder frontmatter+body for a brand-new blank doc/snippet —
 * also doubles as the placeholder content a brand-new (non-seeded) template
 * gets, since "blank boilerplate" and "placeholder content" are the same
 * shape.
 */
export function defaultFrontmatterFor(entryKind: FrontmatterEntryKind, title: string): string {
  if (entryKind === 'document') {
    return `---\ntitle: ${title}\n---\n\n# ${title}\n`
  }
  const name = slugify(title) || 'untitled'
  return `---\nname: ${name}\ndescription: ''\nforked_from: null\nforked_from_snapshot: null\n---\n\n`
}

/** True when `relPath` (relative to templateBaseDir) is inside the archived/ subfolder. */
export function isArchivedTemplatePath(relPath: string): boolean {
  return splitPath(relPath)[0] === TEMPLATE_ARCHIVED_SUBDIR
}

/**
 * Seeds a new doc/snippet's raw file content from a chosen template's body:
 * overwrites only the identity frontmatter field(s) to match the new entry's
 * title, leaving every other frontmatter key and the placeholder body copied
 * verbatim. Never touches the template itself — callers write the result to
 * a brand-new path under docs/ or snippets/.
 *
 * Snippet lineage fields (`forked_from`/`forked_from_snapshot`) are always
 * reset to null, even if the template carried non-null values, so an
 * instantiated snippet never implies it was forked from the template.
 */
export function seedTemplateContent(entryKind: FrontmatterEntryKind, templateBody: string, title: string): string {
  if (entryKind === 'document') {
    return setFrontmatterField(templateBody, 'title', title)
  }
  const name = slugify(title) || 'untitled'
  let out = setFrontmatterField(templateBody, 'name', name)
  out = setFrontmatterField(out, 'forked_from', null)
  out = setFrontmatterField(out, 'forked_from_snapshot', null)
  return out
}
