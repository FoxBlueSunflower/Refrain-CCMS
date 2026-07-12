import { describe, expect, it } from 'vitest'
import { checkHeadingNormalization } from './headingCheck'

describe('checkHeadingNormalization', () => {
  it('warns when there is no H1', () => {
    const warnings = checkHeadingNormalization('Some text with no heading.\n', 'Installing AcmeCloud')
    expect(warnings).toEqual([
      "Add a single H1 heading (# Title) — Phase 9 publications use it as this document's title.",
    ])
  })

  it('passes when a single H1 matches the frontmatter title', () => {
    const warnings = checkHeadingNormalization('\n# Installing AcmeCloud\n\nBody text.\n', 'Installing AcmeCloud')
    expect(warnings).toEqual([])
  })

  it('warns when the single H1 does not match the frontmatter title', () => {
    const warnings = checkHeadingNormalization('\n# Setup Guide\n', 'Installing AcmeCloud')
    expect(warnings).toEqual(["The H1 heading doesn't match the frontmatter title."])
  })

  it('warns when there are multiple H1s', () => {
    const warnings = checkHeadingNormalization('# Installing AcmeCloud\n\nBody.\n\n# Another Title\n', 'Installing AcmeCloud')
    expect(warnings).toEqual(['Multiple H1 headings found — a document should have exactly one (its title).'])
  })

  it('treats an H1 inside a fenced code block as a real H1 (documented non-goal)', () => {
    const warnings = checkHeadingNormalization('# Installing AcmeCloud\n\n```\n# not actually a heading\n```\n', 'Installing AcmeCloud')
    expect(warnings).toEqual(['Multiple H1 headings found — a document should have exactly one (its title).'])
  })

  it('skips the title-mismatch check when no title is set', () => {
    const warnings = checkHeadingNormalization('# Some Heading\n', undefined)
    expect(warnings).toEqual([])
  })

  it('ignores H2-H6 headings entirely', () => {
    const warnings = checkHeadingNormalization('# Installing AcmeCloud\n\n## Step One\n### Details\n', 'Installing AcmeCloud')
    expect(warnings).toEqual([])
  })
})
