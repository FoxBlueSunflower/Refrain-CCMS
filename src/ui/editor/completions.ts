import { type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { ConditionsFile } from '../../core/workspace/types'

export interface CompletionItem {
  key: string
  description: string
}

export interface TokenCompletionItems {
  variables: CompletionItem[]
  snippets: CompletionItem[]
}

/**
 * Completion source for {{key}} and {{> name}} tokens. `getItems` is called
 * on every trigger so callers can back it with a ref that's updated live,
 * without needing to rebuild the CodeMirror extension.
 */
export function createTokenCompletionSource(getItems: () => TokenCompletionItems) {
  return (context: CompletionContext): CompletionResult | null => {
    const textBefore = context.state.sliceDoc(Math.max(0, context.pos - 80), context.pos)
    const match = /\{\{(>\s*)?([\w-]*)$/.exec(textBefore)
    if (!match) return null

    const isSnippetOnly = match[1] !== undefined
    const partial = match[2]
    const from = context.pos - partial.length
    const { variables, snippets } = getItems()

    const options: Completion[] = []
    if (isSnippetOnly) {
      for (const s of snippets) {
        options.push({ label: s.key, detail: s.description || undefined, apply: `${s.key}}}`, type: 'function' })
      }
    } else {
      for (const v of variables) {
        options.push({ label: v.key, detail: v.description || undefined, apply: `${v.key}}}`, type: 'variable' })
      }
      for (const s of snippets) {
        options.push({
          label: `> ${s.key}`,
          detail: s.description || undefined,
          apply: `> ${s.key}}}`,
          type: 'function',
        })
      }
    }

    if (options.length === 0) return null
    return { from, options, validFor: /^[\w-]*$/ }
  }
}

const CONDITION_VALUE_PATTERN = /:::when\s+([A-Za-z0-9_-]+)=([A-Za-z0-9_-]*)$/
const CONDITION_DIMENSION_PATTERN = /:::when\s+([A-Za-z0-9_-]*)$/

/**
 * Completion source for ":::when dimension=value" blocks: offers dimension
 * names first, then values for the chosen dimension sourced from
 * conditions.json. `getConditions` is called on every trigger, same
 * live-ref pattern as createTokenCompletionSource.
 */
export function createConditionCompletionSource(getConditions: () => ConditionsFile) {
  return (context: CompletionContext): CompletionResult | null => {
    const textBefore = context.state.sliceDoc(Math.max(0, context.pos - 80), context.pos)

    const valueMatch = CONDITION_VALUE_PATTERN.exec(textBefore)
    if (valueMatch) {
      const [, dimension, partial] = valueMatch
      const conditions = getConditions()
      const values = conditions[dimension] ?? []
      const from = context.pos - partial.length
      const options: Completion[] = values.map((value) => ({ label: value, type: 'constant' }))
      if (options.length === 0) return null
      return { from, options, validFor: /^[\w-]*$/ }
    }

    const dimensionMatch = CONDITION_DIMENSION_PATTERN.exec(textBefore)
    if (dimensionMatch) {
      const [, partial] = dimensionMatch
      const from = context.pos - partial.length
      const options: Completion[] = Object.keys(getConditions()).map((dimension) => ({
        label: dimension,
        apply: `${dimension}=`,
        type: 'keyword',
      }))
      if (options.length === 0) return null
      return { from, options, validFor: /^[\w-]*$/ }
    }

    return null
  }
}
