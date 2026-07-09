import { describe, expect, it } from 'vitest'
import { resolveDocument } from './resolve'
import type { ResolveContext } from './types'

function ctx(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    variables: {
      product_name: { value: 'AcmeCloud', description: 'Official product name' },
    },
    snippets: {},
    ...overrides,
  }
}

describe('resolveDocument', () => {
  it('substitutes a known variable', () => {
    const result = resolveDocument('Welcome to {{product_name}}.', ctx())
    expect(result.warnings).toEqual([])
    expect(result.text).toContain('>AcmeCloud<')
  })

  it('flags a missing variable and leaves an inline notice', () => {
    const result = resolveDocument('Contact {{support_email}}.', ctx())
    expect(result.warnings).toEqual([{ type: 'missing-variable', key: 'support_email', message: expect.any(String) }])
    expect(result.text).toContain('support_email')
    expect(result.text).toContain('rf-resolve-error')
  })

  it('flags a missing snippet and leaves an inline notice', () => {
    const result = resolveDocument('{{> warning-banner}}', ctx())
    expect(result.warnings).toEqual([{ type: 'missing-snippet', key: 'warning-banner', message: expect.any(String) }])
    expect(result.text).toContain('warning-banner')
    expect(result.text).toContain('rf-resolve-error')
  })

  it('transcludes a snippet and resolves variables inside it (snippet-containing-variable)', () => {
    const result = resolveDocument(
      '{{> support-contact}}',
      ctx({
        snippets: {
          'support-contact': '---\nname: support-contact\n---\n\nQuestions? Email us about {{product_name}}.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([])
    expect(result.text).toContain('Questions? Email us about')
    expect(result.text).toContain('AcmeCloud')
  })

  it('allows one level of snippet-in-snippet nesting', () => {
    const result = resolveDocument(
      '{{> outer}}',
      ctx({
        snippets: {
          outer: '---\nname: outer\n---\n\nOuter start. {{> inner}} Outer end.\n',
          inner: '---\nname: inner\n---\n\nInner content.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([])
    expect(result.text).toContain('Outer start.')
    expect(result.text).toContain('Inner content.')
    expect(result.text).toContain('Outer end.')
  })

  it('refuses nesting deeper than one level with a friendly error', () => {
    const result = resolveDocument(
      '{{> a}}',
      ctx({
        snippets: {
          a: '---\nname: a\n---\n\n{{> b}}\n',
          b: '---\nname: b\n---\n\n{{> c}}\n',
          c: '---\nname: c\n---\n\nToo deep.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([{ type: 'snippet-nesting-too-deep', key: 'c', message: expect.any(String) }])
    expect(result.text).not.toContain('Too deep.')
    expect(result.text).toContain('rf-resolve-error')
  })

  it('detects a circular include and refuses to loop forever', () => {
    const result = resolveDocument(
      '{{> a}}',
      ctx({
        snippets: {
          a: '---\nname: a\n---\n\nA includes {{> b}}.\n',
          b: '---\nname: b\n---\n\nB includes {{> a}}.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([{ type: 'circular-snippet', key: 'a', message: expect.any(String) }])
    expect(result.text).toContain('rf-resolve-error')
  })

  it('detects direct self-inclusion as circular', () => {
    const result = resolveDocument(
      '{{> loop}}',
      ctx({
        snippets: {
          loop: '---\nname: loop\n---\n\nSelf: {{> loop}}.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([{ type: 'circular-snippet', key: 'loop', message: expect.any(String) }])
  })
})
