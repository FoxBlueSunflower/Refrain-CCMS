import type { ConditionsFile, VariablesFile } from '../workspace/types'
import type { ConditionDiscrepancy, VariableDiscrepancy } from './types'

/** Key-level diff of two variables tables, comparing each variable's value (not its description). Sorted by key. */
export function diffVariables(before: VariablesFile, after: VariablesFile): VariableDiscrepancy[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const result: VariableDiscrepancy[] = []

  for (const key of keys) {
    const beforeValue = before[key]?.value
    const afterValue = after[key]?.value
    if (beforeValue !== afterValue) {
      result.push({ key, before: beforeValue, after: afterValue })
    }
  }

  return result.sort((a, b) => a.key.localeCompare(b.key))
}

function sameValueSet(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== setB.size) return false
  for (const value of setA) {
    if (!setB.has(value)) return false
  }
  return true
}

/** Key-level diff of two condition-dimension tables. A value list that's merely reordered is not a change. Sorted by dimension. */
export function diffConditions(before: ConditionsFile, after: ConditionsFile): ConditionDiscrepancy[] {
  const dimensions = new Set([...Object.keys(before), ...Object.keys(after)])
  const result: ConditionDiscrepancy[] = []

  for (const dimension of dimensions) {
    const beforeValues = before[dimension]
    const afterValues = after[dimension]
    if (!sameValueSet(beforeValues, afterValues)) {
      result.push({ dimension, before: beforeValues, after: afterValues })
    }
  }

  return result.sort((a, b) => a.dimension.localeCompare(b.dimension))
}
