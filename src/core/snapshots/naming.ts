import type { SnapshotKind } from './types'

const KINDS: SnapshotKind[] = ['publish', 'manual', 'restore']

/** The trailing "-N" is a collision suffix (see writeSnapshot in src/fs/snapshots.ts) for two same-kind snapshots taken within the same minute — timestamp/kind are still parsed out of it the same way. */
const DIR_NAME_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{4})_(publish|manual|restore)(?:-\d+)?$/

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/** "2026-07-08T1430" — UTC, matching SPEC.md's snapshot folder example. */
export function formatSnapshotTimestamp(at: Date = new Date()): string {
  const year = at.getUTCFullYear()
  const month = pad(at.getUTCMonth() + 1)
  const day = pad(at.getUTCDate())
  const hours = pad(at.getUTCHours())
  const minutes = pad(at.getUTCMinutes())
  return `${year}-${month}-${day}T${hours}${minutes}`
}

export function snapshotDirName(kind: SnapshotKind, at: Date = new Date()): string {
  return `${formatSnapshotTimestamp(at)}_${kind}`
}

/** Never throws — returns null for anything that doesn't match, so a stray folder under .app/history/ is skipped rather than crashing listSnapshots. */
export function parseSnapshotDirName(name: string): { timestamp: string; kind: SnapshotKind } | null {
  const match = DIR_NAME_PATTERN.exec(name)
  if (!match) return null
  const [, timestamp, kind] = match
  if (!KINDS.includes(kind as SnapshotKind)) return null
  return { timestamp, kind: kind as SnapshotKind }
}
