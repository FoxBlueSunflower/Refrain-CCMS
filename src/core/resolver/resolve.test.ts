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

  it('HTML-escapes a variable value so it cannot inject markup', () => {
    const result = resolveDocument(
      'Say {{greeting}}.',
      ctx({
        variables: {
          greeting: { value: '<img src=x onerror=alert(1)>', description: '' },
        },
      }),
    )
    expect(result.warnings).toEqual([])
    expect(result.text).not.toContain('<img')
    expect(result.text).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('leaves a document with no tokens unchanged', () => {
    const result = resolveDocument('Just plain markdown, no tokens here.\n', ctx())
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Just plain markdown, no tokens here.\n')
  })

  it('reports every missing variable in a document, not just the first', () => {
    const result = resolveDocument('{{first_missing}} and {{second_missing}}', ctx())
    expect(result.warnings).toEqual([
      { type: 'missing-variable', key: 'first_missing', message: expect.any(String) },
      { type: 'missing-variable', key: 'second_missing', message: expect.any(String) },
    ])
  })

  it('leaves {{key}}/{{> name}} syntax shown as a documentation example inside a fenced code block untouched', () => {
    const text = ['Here is an example:', '```', 'Say {{product_name}} and {{> some-snippet}}.', '```'].join('\n')
    const result = resolveDocument(text, ctx())
    expect(result.warnings).toEqual([])
    expect(result.text).toBe(text)
  })

  it('still resolves tokens outside the fence in the same document', () => {
    const text = ['Welcome to {{product_name}}.', '```', 'Say {{product_name}}.', '```', 'Also {{product_name}}.'].join('\n')
    const result = resolveDocument(text, ctx())
    expect(result.warnings).toEqual([])
    const occurrences = result.text.split('>AcmeCloud<').length - 1
    expect(occurrences).toBe(2)
    expect(result.text).toContain('Say {{product_name}}.')
  })
})

describe('resolveDocument — plain mode', () => {
  it('substitutes a known variable with its raw, unwrapped value', () => {
    const result = resolveDocument('Welcome to {{product_name}}.', ctx({ mode: 'plain' }))
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Welcome to AcmeCloud.')
    expect(result.text).not.toContain('<span')
  })

  it('does not HTML-escape a variable value in plain mode', () => {
    const result = resolveDocument(
      'Say {{greeting}}.',
      ctx({ mode: 'plain', variables: { greeting: { value: '<b>Hi</b> & welcome', description: '' } } }),
    )
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Say <b>Hi</b> & welcome.')
  })

  it('flags a missing variable with a bare warning notice, no span markup', () => {
    const result = resolveDocument('Contact {{support_email}}.', ctx({ mode: 'plain' }))
    expect(result.warnings).toEqual([{ type: 'missing-variable', key: 'support_email', message: expect.any(String) }])
    expect(result.text).toContain('⚠')
    expect(result.text).not.toContain('<span')
    expect(result.text).not.toContain('rf-resolve-error')
  })

  it('flags a missing snippet with a bare warning notice, no span markup', () => {
    const result = resolveDocument('{{> warning-banner}}', ctx({ mode: 'plain' }))
    expect(result.warnings).toEqual([{ type: 'missing-snippet', key: 'warning-banner', message: expect.any(String) }])
    expect(result.text).toContain('⚠')
    expect(result.text).not.toContain('<span')
  })

  it('flags a circular include with a bare warning notice, no span markup', () => {
    const result = resolveDocument(
      '{{> loop}}',
      ctx({ mode: 'plain', snippets: { loop: '---\nname: loop\n---\n\nSelf: {{> loop}}.\n' } }),
    )
    expect(result.warnings).toEqual([{ type: 'circular-snippet', key: 'loop', message: expect.any(String) }])
    expect(result.text).toContain('⚠')
    expect(result.text).not.toContain('<span')
  })

  it('flags nesting deeper than one level with a bare warning notice, no span markup', () => {
    const result = resolveDocument(
      '{{> a}}',
      ctx({
        mode: 'plain',
        snippets: {
          a: '---\nname: a\n---\n\n{{> b}}\n',
          b: '---\nname: b\n---\n\n{{> c}}\n',
          c: '---\nname: c\n---\n\nToo deep.\n',
        },
      }),
    )
    expect(result.warnings).toEqual([{ type: 'snippet-nesting-too-deep', key: 'c', message: expect.any(String) }])
    expect(result.text).not.toContain('Too deep.')
    expect(result.text).toContain('⚠')
    expect(result.text).not.toContain('<span')
  })

  it('transcludes a snippet and resolves variables inside it as plain text', () => {
    const result = resolveDocument(
      '{{> support-contact}}',
      ctx({
        mode: 'plain',
        snippets: { 'support-contact': '---\nname: support-contact\n---\n\nQuestions? Email us about {{product_name}}.\n' },
      }),
    )
    expect(result.warnings).toEqual([])
    expect(result.text.trim()).toBe('Questions? Email us about AcmeCloud.')
  })

  it('leaves {{key}}/{{> name}} syntax inside a fenced code block untouched in plain mode too', () => {
    const text = ['Here is an example:', '```', 'Say {{product_name}} and {{> some-snippet}}.', '```'].join('\n')
    const result = resolveDocument(text, ctx({ mode: 'plain' }))
    expect(result.warnings).toEqual([])
    expect(result.text).toBe(text)
  })
})
