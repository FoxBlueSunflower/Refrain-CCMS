import type { SnapshotDiff, SnapshotFile } from './types'

function toMap(files: SnapshotFile[]): Map<string, string> {
  return new Map(files.map((file) => [file.path, file.contents]))
}

/** Diffs two flat snapshot-file lists by path and content equality. All three output arrays are sorted alphabetically. */
export function diffSnapshotFiles(previous: SnapshotFile[], current: SnapshotFile[]): SnapshotDiff {
  const previousMap = toMap(previous)
  const currentMap = toMap(current)

  const added: string[] = []
  const updated: string[] = []
  const removed: string[] = []

  for (const [path, contents] of currentMap) {
    if (!previousMap.has(path)) {
      added.push(path)
    } else if (previousMap.get(path) !== contents) {
      updated.push(path)
    }
  }

  for (const path of previousMap.keys()) {
    if (!currentMap.has(path)) removed.push(path)
  }

  return { added: added.sort(), updated: updated.sort(), removed: removed.sort() }
}
