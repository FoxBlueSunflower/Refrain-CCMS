import { describe, expect, it } from 'vitest'
import { formatSnapshotTimestamp, parseSnapshotDirName, snapshotDirName } from './naming'

const FIXED_DATE = new Date('2026-07-08T14:30:00.000Z')

describe('formatSnapshotTimestamp', () => {
  it('formats a fixed date as YYYY-MM-DDTHHmm in UTC', () => {
    expect(formatSnapshotTimestamp(FIXED_DATE)).toBe('2026-07-08T1430')
  })
})

describe('snapshotDirName', () => {
  it('appends the kind suffix to the formatted timestamp', () => {
    expect(snapshotDirName('publish', FIXED_DATE)).toBe('2026-07-08T1430_publish')
    expect(snapshotDirName('manual', FIXED_DATE)).toBe('2026-07-08T1430_manual')
    expect(snapshotDirName('restore', FIXED_DATE)).toBe('2026-07-08T1430_restore')
  })
})

describe('parseSnapshotDirName', () => {
  it('round-trips every snapshot kind', () => {
    expect(parseSnapshotDirName('2026-07-08T1430_publish')).toEqual({ timestamp: '2026-07-08T1430', kind: 'publish' })
    expect(parseSnapshotDirName('2026-07-08T1430_manual')).toEqual({ timestamp: '2026-07-08T1430', kind: 'manual' })
    expect(parseSnapshotDirName('2026-07-08T1430_restore')).toEqual({ timestamp: '2026-07-08T1430', kind: 'restore' })
  })

  it('returns null for a folder name that does not match the snapshot naming scheme', () => {
    expect(parseSnapshotDirName('some-stray-folder')).toBeNull()
    expect(parseSnapshotDirName('2026-07-08T1430_unknown-kind')).toBeNull()
  })

  it('parses a collision-suffixed name (two same-kind snapshots in the same minute) the same as the unsuffixed one', () => {
    expect(parseSnapshotDirName('2026-07-08T1430_publish-2')).toEqual({ timestamp: '2026-07-08T1430', kind: 'publish' })
  })
})
