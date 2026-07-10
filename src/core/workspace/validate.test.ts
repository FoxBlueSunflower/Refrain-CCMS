import { describe, expect, it } from 'vitest'
import { validateConditionsFile, validateVariablesFile, validateWorkspaceConfig } from './validate'

const validWorkspace = {
  name: 'Acme Product Docs',
  site: { title: 'Acme Docs', logo: 'assets/logo.png' },
  publishProfiles: {
    public: { audience: ['customer'], output: ['web'] },
    internal: { audience: ['customer', 'internal'], output: ['web'] },
  },
  formatVersion: 1,
}

describe('validateWorkspaceConfig', () => {
  it('accepts a well-formed workspace.json', () => {
    const result = validateWorkspaceConfig(validWorkspace)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Acme Product Docs')
      expect(result.value.publishProfiles.public.audience).toEqual(['customer'])
      expect(result.warnings).toEqual([])
    }
  })

  it('accepts a workspace.json with no logo', () => {
    const result = validateWorkspaceConfig({ ...validWorkspace, site: { title: 'Acme Docs' } })
    expect(result.ok).toBe(true)
  })

  it('rejects a non-object payload', () => {
    const result = validateWorkspaceConfig('not json')
    expect(result.ok).toBe(false)
  })

  it('rejects when "name" is missing', () => {
    const { name, ...rest } = validWorkspace
    void name
    const result = validateWorkspaceConfig(rest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('name'))).toBe(true)
    }
  })

  it('rejects when "site" is missing', () => {
    const { site, ...rest } = validWorkspace
    void site
    const result = validateWorkspaceConfig(rest)
    expect(result.ok).toBe(false)
  })

  it('rejects when "publishProfiles" is missing', () => {
    const { publishProfiles, ...rest } = validWorkspace
    void publishProfiles
    const result = validateWorkspaceConfig(rest)
    expect(result.ok).toBe(false)
  })

  it('rejects a malformed publish profile', () => {
    const result = validateWorkspaceConfig({
      ...validWorkspace,
      publishProfiles: { public: { audience: 'not-an-array', output: ['web'] } },
    })
    expect(result.ok).toBe(false)
  })

  it('warns (but does not fail) on a formatVersion mismatch', () => {
    const result = validateWorkspaceConfig({ ...validWorkspace, formatVersion: 2 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes('formatVersion'))).toBe(true)
    }
  })

  it('rejects when "formatVersion" is missing', () => {
    const { formatVersion, ...rest } = validWorkspace
    void formatVersion
    const result = validateWorkspaceConfig(rest)
    expect(result.ok).toBe(false)
  })
})

describe('validateVariablesFile', () => {
  const validVariables = {
    product_name: { value: 'AcmeCloud', description: 'Official product name' },
    support_email: { value: 'help@acme.com', description: '' },
  }

  it('accepts a well-formed variables.json', () => {
    const result = validateVariablesFile(validVariables)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.product_name.value).toBe('AcmeCloud')
    }
  })

  it('rejects a non-object payload', () => {
    expect(validateVariablesFile([1, 2, 3]).ok).toBe(false)
  })

  it('rejects an entry missing "value"', () => {
    const result = validateVariablesFile({ product_name: { description: 'x' } })
    expect(result.ok).toBe(false)
  })

  it('rejects an entry missing "description"', () => {
    const result = validateVariablesFile({ product_name: { value: 'x' } })
    expect(result.ok).toBe(false)
  })

  it('rejects an entry that is not an object', () => {
    const result = validateVariablesFile({ product_name: 'AcmeCloud' })
    expect(result.ok).toBe(false)
  })
})

describe('validateConditionsFile', () => {
  it('accepts a well-formed conditions.json', () => {
    const result = validateConditionsFile({ audience: ['customer', 'internal'], output: ['web'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.audience).toEqual(['customer', 'internal'])
    }
  })

  it('rejects when "audience" is not a string array', () => {
    const result = validateConditionsFile({ audience: 'customer', output: ['web'] })
    expect(result.ok).toBe(false)
  })

  it('accepts a conditions.json missing "output" — dimensions are no longer a fixed set', () => {
    const result = validateConditionsFile({ audience: ['customer'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ audience: ['customer'] })
    }
  })

  it('accepts a conditions.json with any dimension name', () => {
    const result = validateConditionsFile({ audience: ['customer'], output: ['web'], locale: ['en'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.locale).toEqual(['en'])
      expect(result.warnings).toEqual([])
    }
  })

  it('accepts an empty conditions.json — no dimensions defined yet', () => {
    const result = validateConditionsFile({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })
})
