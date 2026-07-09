import { parseFrontmatter } from '../frontmatter/parse'
import type { ResolveContext, ResolveResult, ResolverWarning } from './types'

/**
 * Depth budget for {{> name}} expansion: a document including a snippet is
 * depth 1, that snippet including another is depth 2 ("one level of
 * snippet-in-snippet allowed" per SPEC.md). Depth 3 is refused.
 */
const MAX_SNIPPET_DEPTH = 2

const TOKEN_PATTERN = /\{\{(>)?\s*([A-Za-z0-9_-]+)\s*\}\}/g

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function errorNotice(message: string): string {
  return `<span class="rf-resolve-error" title="${escapeHtml(message)}">⚠ ${escapeHtml(message)}</span>`
}

function resolveVariableRef(key: string, ctx: ResolveContext, warnings: ResolverWarning[]): string {
  const entry = ctx.variables[key]
  if (!entry) {
    warnings.push({ type: 'missing-variable', key, message: `Variable "${key}" is not defined in variables.json.` })
    return errorNotice(`{{${key}}} not found`)
  }
  return `<span class="rf-resolved-var" title="{{${key}}}">${escapeHtml(entry.value)}</span>`
}

function resolveSnippetRef(
  name: string,
  ctx: ResolveContext,
  ancestors: readonly string[],
  depth: number,
  warnings: ResolverWarning[],
): string {
  if (ancestors.includes(name)) {
    warnings.push({
      type: 'circular-snippet',
      key: name,
      message: `Circular snippet include: "${name}" is already part of this chain (${[...ancestors, name].join(' → ')}).`,
    })
    return errorNotice(`Circular snippet include: "${name}"`)
  }

  const raw = ctx.snippets[name]
  if (raw === undefined) {
    warnings.push({ type: 'missing-snippet', key: name, message: `Snippet "${name}" was not found in snippets/.` })
    return errorNotice(`Snippet "${name}" not found`)
  }

  if (depth + 1 > MAX_SNIPPET_DEPTH) {
    warnings.push({
      type: 'snippet-nesting-too-deep',
      key: name,
      message: `Snippet "${name}" is nested too deep (max one level of snippet-in-snippet) and was not expanded.`,
    })
    return errorNotice(`Snippet "${name}" nested too deep (max 1 level)`)
  }

  const { body } = parseFrontmatter(raw)
  return resolveBody(body, ctx, [...ancestors, name], depth + 1, warnings)
}

function resolveBody(body: string, ctx: ResolveContext, ancestors: readonly string[], depth: number, warnings: ResolverWarning[]): string {
  return body.replace(TOKEN_PATTERN, (_match, marker: string | undefined, key: string) => {
    if (marker === '>') return resolveSnippetRef(key, ctx, ancestors, depth, warnings)
    return resolveVariableRef(key, ctx, warnings)
  })
}

/**
 * Resolves {{key}} variable substitutions and {{> name}} snippet
 * transclusions in a document or snippet body. Pure and synchronous — no
 * file access; callers supply already-loaded variables and snippet sources.
 */
export function resolveDocument(body: string, ctx: ResolveContext): ResolveResult {
  const warnings: ResolverWarning[] = []
  const text = resolveBody(body, ctx, [], 0, warnings)
  return { text, warnings }
}
