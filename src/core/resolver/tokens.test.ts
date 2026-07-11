import { describe, expect, it } from 'vitest'
import { findTokenMatches } from './tokens'

describe('findTokenMatches', () => {
  it('matches a variable reference', () => {
    const matches = findTokenMatches('Welcome to {{product_name}}.')
    expect(matches).toEqual([{ from: 11, to: 27, kind: 'variable', key: 'product_name' }])
  })

  it('matches a snippet reference', () => {
    const matches = findTokenMatches('{{> warning-banner}}')
    expect(matches).toEqual([{ from: 0, to: 20, kind: 'snippet', key: 'warning-banner' }])
  })

  it('returns an empty array for a body with no tokens', () => {
    expect(findTokenMatches('Just plain markdown, no tokens here.')).toEqual([])
  })

  it('finds multiple tokens in document order', () => {
    const matches = findTokenMatches('{{first}} and {{> second}} and {{third}}')
    expect(matches.map((m) => m.key)).toEqual(['first', 'second', 'third'])
    expect(matches.map((m) => m.kind)).toEqual(['variable', 'snippet', 'variable'])
  })

  it('reports positions that slice back to the original token text', () => {
    const body = 'Say {{greeting}} to {{> intro}} today.'
    const matches = findTokenMatches(body)
    expect(matches.map((m) => body.slice(m.from, m.to))).toEqual(['{{greeting}}', '{{> intro}}'])
  })

  it('ignores malformed braces that are not valid identifiers', () => {
    expect(findTokenMatches('{{}} and {{ }} and {{{nested}}}')).toEqual([
      { from: 20, to: 30, kind: 'variable', key: 'nested' },
    ])
  })
})
