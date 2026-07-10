import { describe, expect, it } from 'vitest'
import type { ConditionsFile, VariablesFile } from '../workspace/types'
import { diffConditions, diffVariables } from './discrepancy'

function variable(value: string): VariablesFile[string] {
  return { value, description: '' }
}

describe('diffVariables', () => {
  it('reports no discrepancies for identical tables', () => {
    const table: VariablesFile = { product_name: variable('Acme') }
    expect(diffVariables(table, table)).toEqual([])
  })

  it('reports a removed key with after undefined', () => {
    const before: VariablesFile = { support_email: variable('help@acme.com') }
    expect(diffVariables(before, {})).toEqual([{ key: 'support_email', before: 'help@acme.com', after: undefined }])
  })

  it('reports an added key with before undefined', () => {
    const after: VariablesFile = { support_email: variable('help@acme.com') }
    expect(diffVariables({}, after)).toEqual([{ key: 'support_email', before: undefined, after: 'help@acme.com' }])
  })

  it('reports a changed value for a key present in both', () => {
    const before: VariablesFile = { product_name: variable('Acme') }
    const after: VariablesFile = { product_name: variable('Acme Inc') }
    expect(diffVariables(before, after)).toEqual([{ key: 'product_name', before: 'Acme', after: 'Acme Inc' }])
  })

  it('partitions added, removed, changed, and unchanged keys in one call', () => {
    const before: VariablesFile = {
      keep: variable('same'),
      change: variable('old'),
      gone: variable('bye'),
    }
    const after: VariablesFile = {
      keep: variable('same'),
      change: variable('new'),
      fresh: variable('hi'),
    }
    expect(diffVariables(before, after)).toEqual([
      { key: 'change', before: 'old', after: 'new' },
      { key: 'fresh', before: undefined, after: 'hi' },
      { key: 'gone', before: 'bye', after: undefined },
    ])
  })
})

describe('diffConditions', () => {
  it('reports no discrepancies for identical tables', () => {
    const table: ConditionsFile = { audience: ['customer', 'internal'] }
    expect(diffConditions(table, table)).toEqual([])
  })

  it('reports a removed dimension with after undefined', () => {
    const before: ConditionsFile = { audience: ['customer'] }
    expect(diffConditions(before, {})).toEqual([{ dimension: 'audience', before: ['customer'], after: undefined }])
  })

  it('reports an added dimension with before undefined', () => {
    const after: ConditionsFile = { audience: ['customer'] }
    expect(diffConditions({}, after)).toEqual([{ dimension: 'audience', before: undefined, after: ['customer'] }])
  })

  it('reports a changed value list for a dimension present in both', () => {
    const before: ConditionsFile = { audience: ['customer', 'internal'] }
    const after: ConditionsFile = { audience: ['customer'] }
    expect(diffConditions(before, after)).toEqual([{ dimension: 'audience', before: ['customer', 'internal'], after: ['customer'] }])
  })

  it('treats a reordered but set-equal value list as no change', () => {
    const before: ConditionsFile = { audience: ['customer', 'internal'] }
    const after: ConditionsFile = { audience: ['internal', 'customer'] }
    expect(diffConditions(before, after)).toEqual([])
  })
})
