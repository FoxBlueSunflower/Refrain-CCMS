import { describe, expect, it } from 'vitest'
import { collectRefs } from './scan'

describe('collectRefs', () => {
  it('finds a variable reference', () => {
    const refs = collectRefs('Welcome to {{product_name}}.')
    expect([...refs.variables]).toEqual(['product_name'])
    expect(refs.snippets.size).toBe(0)
    expect(refs.conditions.size).toBe(0)
  })

  it('finds a snippet transclusion', () => {
    const refs = collectRefs('{{> warning-banner}}')
    expect([...refs.snippets]).toEqual(['warning-banner'])
    expect(refs.variables.size).toBe(0)
  })

  it('finds references inside frontmatter, not just the body', () => {
    const refs = collectRefs('---\ntitle: Installing {{product_name}}\n---\n\nBody has no tokens.\n')
    expect([...refs.variables]).toEqual(['product_name'])
  })

  it('finds a condition block', () => {
    const refs = collectRefs(':::when audience=internal\nInternal note.\n:::')
    expect([...refs.conditions]).toEqual(['audience=internal'])
  })

  it('dedupes repeated references', () => {
    const refs = collectRefs('{{version}} ... {{version}} ... {{> foo}} ... {{> foo}}')
    expect([...refs.variables]).toEqual(['version'])
    expect([...refs.snippets]).toEqual(['foo'])
  })

  it('returns empty sets for plain text with no tokens', () => {
    const refs = collectRefs('Just plain markdown.\n')
    expect(refs.variables.size).toBe(0)
    expect(refs.snippets.size).toBe(0)
    expect(refs.conditions.size).toBe(0)
  })
})
