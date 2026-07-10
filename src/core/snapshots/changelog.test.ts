import { describe, expect, it } from 'vitest'
import { renderChangelog } from './changelog'
import type { PublishLogEntry } from './types'

function entry(at: string, profile: string, changes: PublishLogEntry['changes']): PublishLogEntry {
  return { at, profile, snapshot: `${at}_publish`, changes }
}

describe('renderChangelog', () => {
  it('renders just the heading for an empty log', () => {
    expect(renderChangelog([])).toBe('# Changelog\n')
  })

  it('renders one entry with all three change types under a dated, profile-labeled heading', () => {
    const log = [entry('2026-07-08T14:30:00.000Z', 'public', { added: ['docs/faq.md'], updated: ['docs/index.md'], removed: ['docs/old.md'] })]
    const markdown = renderChangelog(log)
    expect(markdown).toBe(
      '# Changelog\n\n## 2026-07-08 14:30 — public\n- Added: docs/faq.md\n- Updated: docs/index.md\n- Removed: docs/old.md\n',
    )
  })

  it('renders multiple entries most-recent-first even though the log is stored chronologically', () => {
    const log = [
      entry('2026-07-08T09:10:00.000Z', 'internal', { added: [], updated: [], removed: [] }),
      entry('2026-07-08T14:30:00.000Z', 'public', { added: ['docs/faq.md'], updated: [], removed: [] }),
    ]
    const markdown = renderChangelog(log)
    const publicIndex = markdown.indexOf('## 2026-07-08 14:30 — public')
    const internalIndex = markdown.indexOf('## 2026-07-08 09:10 — internal')
    expect(publicIndex).toBeGreaterThanOrEqual(0)
    expect(internalIndex).toBeGreaterThan(publicIndex)
  })

  it('renders "No changes." for an entry with an empty diff instead of empty bullet lists', () => {
    const log = [entry('2026-07-08T09:10:00.000Z', 'internal', { added: [], updated: [], removed: [] })]
    expect(renderChangelog(log)).toBe('# Changelog\n\n## 2026-07-08 09:10 — internal\n- No changes.\n')
  })
})
