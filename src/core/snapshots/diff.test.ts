import { describe, expect, it } from 'vitest'
import { buildSampleWorkspaceFiles } from '../workspace/sample-workspace'
import { diffSnapshotFiles } from './diff'
import type { SnapshotFile } from './types'

function file(path: string, contents: string): SnapshotFile {
  return { path, contents }
}

describe('diffSnapshotFiles', () => {
  it('marks every file as added when there is no previous snapshot', () => {
    const current = [file('docs/a.md', 'A'), file('docs/b.md', 'B')]
    const diff = diffSnapshotFiles([], current)
    expect(diff).toEqual({ added: ['docs/a.md', 'docs/b.md'], updated: [], removed: [] })
  })

  it('reports no changes when previous and current are identical', () => {
    const files = [file('docs/a.md', 'A'), file('docs/b.md', 'B')]
    const diff = diffSnapshotFiles(files, files)
    expect(diff).toEqual({ added: [], updated: [], removed: [] })
  })

  it('detects a content change to an existing path as updated only', () => {
    const diff = diffSnapshotFiles([file('docs/a.md', 'old')], [file('docs/a.md', 'new')])
    expect(diff).toEqual({ added: [], updated: ['docs/a.md'], removed: [] })
  })

  it('detects a path present before and gone now as removed', () => {
    const diff = diffSnapshotFiles([file('docs/a.md', 'A')], [])
    expect(diff).toEqual({ added: [], updated: [], removed: ['docs/a.md'] })
  })

  it('detects a new path alongside unchanged files, leaving the unchanged ones out of every list', () => {
    const unchanged = file('docs/unchanged.md', 'same')
    const diff = diffSnapshotFiles([unchanged], [unchanged, file('docs/new.md', 'new')])
    expect(diff).toEqual({ added: ['docs/new.md'], updated: [], removed: [] })
  })

  it('partitions a mix of added, updated, removed, and unchanged files in one call', () => {
    const previous = [file('docs/keep.md', 'same'), file('docs/change.md', 'old'), file('docs/gone.md', 'bye')]
    const current = [file('docs/keep.md', 'same'), file('docs/change.md', 'new'), file('docs/fresh.md', 'hi')]
    const diff = diffSnapshotFiles(previous, current)
    expect(diff).toEqual({ added: ['docs/fresh.md'], updated: ['docs/change.md'], removed: ['docs/gone.md'] })
  })

  it('sorts added/updated/removed alphabetically regardless of input order', () => {
    const previous = [file('docs/z-change.md', 'old'), file('docs/z-gone.md', 'bye')]
    const current = [file('docs/z-change.md', 'new'), file('docs/a-new.md', 'hi')]
    const diff = diffSnapshotFiles(previous, current)
    expect(diff).toEqual({ added: ['docs/a-new.md'], updated: ['docs/z-change.md'], removed: ['docs/z-gone.md'] })
  })

  it('detects a single snippet edit within the sample workspace as the only update', () => {
    const files = buildSampleWorkspaceFiles()
    const edited = files.map((f) =>
      f.path === 'snippets/warning-banner.md' ? { path: f.path, contents: `${f.contents}\nExtra line.` } : file(f.path, f.contents),
    )
    const diff = diffSnapshotFiles(
      files.map((f) => file(f.path, f.contents)),
      edited,
    )
    expect(diff).toEqual({ added: [], updated: ['snippets/warning-banner.md'], removed: [] })
  })
})
