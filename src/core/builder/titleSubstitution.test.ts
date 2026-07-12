import { describe, expect, it } from 'vitest'
import type { VariablesFile } from '../workspace/types'
import { substituteTitleVariables } from './titleSubstitution'

describe('substituteTitleVariables', () => {
  const variables: VariablesFile = {
    product_name: { value: 'AcmeCloud', description: '' },
    version: { value: '3.2', description: '' },
  }

  it('substitutes a known variable', () => {
    expect(substituteTitleVariables('{{product_name}} Guide', variables)).toBe('AcmeCloud Guide')
  })

  it('substitutes multiple variables in the same title', () => {
    expect(substituteTitleVariables('{{product_name}} v{{version}}', variables)).toBe('AcmeCloud v3.2')
  })

  it('leaves an unresolved key literal, with no warning mechanism to report it', () => {
    expect(substituteTitleVariables('{{unknown_key}} Guide', variables)).toBe('{{unknown_key}} Guide')
  })

  it('leaves a title with no tokens unchanged', () => {
    expect(substituteTitleVariables('Plain Title', variables)).toBe('Plain Title')
  })
})
