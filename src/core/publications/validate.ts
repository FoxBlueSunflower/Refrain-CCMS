import { isPlainObject, type ValidationResult } from '../workspace/validate'
import type { Publication, PublicationNode } from './types'

function validateNode(json: unknown, path: string, errors: string[]): PublicationNode | undefined {
  if (!isPlainObject(json)) {
    errors.push(`${path} must be an object`)
    return undefined
  }

  if (json.type === 'doc') {
    if (typeof json.ref !== 'string' || json.ref.length === 0) {
      errors.push(`${path}: "ref" must be a non-empty string`)
      return undefined
    }
    return { type: 'doc', ref: json.ref }
  }

  if (json.type === 'heading') {
    if (typeof json.title !== 'string' || json.title.length === 0) {
      errors.push(`${path}: "title" must be a non-empty string`)
      return undefined
    }
    if (json.children === undefined) {
      return { type: 'heading', title: json.title }
    }
    if (!Array.isArray(json.children)) {
      errors.push(`${path}: "children" must be an array when present`)
      return undefined
    }
    const children: PublicationNode[] = []
    let ok = true
    json.children.forEach((child, index) => {
      const node = validateNode(child, `${path}.children[${index}]`, errors)
      if (node) children.push(node)
      else ok = false
    })
    if (!ok) return undefined
    return { type: 'heading', title: json.title, children }
  }

  errors.push(`${path}: "type" must be "doc" or "heading"`)
  return undefined
}

/**
 * Validates a publication JSON file (publications/*.json, Phase 9b). Nodes
 * are pointers into docs/, not copies, so this only checks shape — it does
 * not verify a `doc` node's `ref` actually exists on disk (fail-soft, same
 * spirit as broken-link pills: a dangling ref is a later, non-blocking
 * concern, not a reason to refuse loading the publication).
 */
export function validatePublication(json: unknown): ValidationResult<Publication> {
  const errors: string[] = []

  if (!isPlainObject(json)) {
    return { ok: false, errors: ['publication must be a JSON object'] }
  }

  if (typeof json.title !== 'string' || json.title.length === 0) {
    errors.push('publication: "title" must be a non-empty string')
  }

  if (!Array.isArray(json.nodes)) {
    errors.push('publication: "nodes" must be an array')
    return { ok: false, errors }
  }

  const nodes: PublicationNode[] = []
  json.nodes.forEach((node, index) => {
    const validated = validateNode(node, `nodes[${index}]`, errors)
    if (validated) nodes.push(validated)
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: { title: json.title as string, nodes }, warnings: [] }
}
