import { describe, expect, it } from 'vitest'
import { shiftHeadingLevels } from './headingShift'

describe('shiftHeadingLevels', () => {
  it('leaves the body unchanged when targetLevel is 1 (offset 0)', () => {
    const body = '# Title\n\nSome text.\n\n## Section\n'
    const result = shiftHeadingLevels(body, 1, 'docs/a.md')
    expect(result.text).toBe(body)
    expect(result.warnings).toEqual([])
  })

  it('shifts H1/H2/H3 to H3/H4/H5 for targetLevel 3, leaving other lines untouched', () => {
    const body = '# Title\n\nIntro text.\n\n## Section\n\nBody text.\n\n### Subsection\n'
    const result = shiftHeadingLevels(body, 3, 'docs/a.md')
    expect(result.text).toBe('### Title\n\nIntro text.\n\n#### Section\n\nBody text.\n\n##### Subsection\n')
    expect(result.warnings).toEqual([])
  })

  it('clamps a heading that would exceed H6 and warns with the correct line', () => {
    const body = '# Title\n\n##### Deep\n\n###### Deepest\n'
    const result = shiftHeadingLevels(body, 3, 'docs/a.md')
    // offset = 2: H1->H3, H5->H7 (clamped to H6), H6->H8 (clamped to H6)
    expect(result.text).toBe('### Title\n\n###### Deep\n\n###### Deepest\n')
    expect(result.warnings).toEqual([
      { type: 'heading-level-exceeds-h6', file: 'docs/a.md', line: 3, message: expect.any(String) },
      { type: 'heading-level-exceeds-h6', file: 'docs/a.md', line: 5, message: expect.any(String) },
    ])
  })
})
