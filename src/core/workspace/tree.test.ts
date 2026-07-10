import { describe, expect, it } from 'vitest'
import { buildDocTree } from './tree'
import type { FolderMeta, RawEntry } from './types'

describe('buildDocTree', () => {
  it('returns an empty array for an empty docs/ folder', () => {
    expect(buildDocTree([], new Map())).toEqual([])
  })

  it('nests a flat entry list into a tree', () => {
    const entries: RawEntry[] = [
      { path: 'index.md', kind: 'file' },
      { path: 'getting-started.md', kind: 'file' },
      { path: 'guides', kind: 'directory' },
      { path: 'guides/installation.md', kind: 'file' },
    ]
    const tree = buildDocTree(entries, new Map())

    const guides = tree.find((n) => n.path === 'guides')
    expect(guides?.kind).toBe('folder')
    expect(guides?.children?.map((c) => c.path)).toEqual(['guides/installation.md'])
  })

  it('derives file labels from the filename minus .md', () => {
    const entries: RawEntry[] = [{ path: 'getting-started.md', kind: 'file' }]
    const tree = buildDocTree(entries, new Map())
    expect(tree[0]).toEqual({ kind: 'file', name: 'getting-started', path: 'getting-started.md' })
  })

  it('excludes non-.md files (e.g. _folder.json) from the tree', () => {
    const entries: RawEntry[] = [
      { path: 'guides', kind: 'directory' },
      { path: 'guides/_folder.json', kind: 'file' },
      { path: 'guides/installation.md', kind: 'file' },
    ]
    const tree = buildDocTree(entries, new Map())
    const guides = tree.find((n) => n.path === 'guides')
    expect(guides?.children?.map((c) => c.path)).toEqual(['guides/installation.md'])
  })

  it('sorts siblings alphabetically when no folder order is given', () => {
    const entries: RawEntry[] = [
      { path: 'zebra.md', kind: 'file' },
      { path: 'alpha.md', kind: 'file' },
      { path: 'mid.md', kind: 'file' },
    ]
    const tree = buildDocTree(entries, new Map())
    expect(tree.map((n) => n.path)).toEqual(['alpha.md', 'mid.md', 'zebra.md'])
  })

  it('applies _folder.json order/title overrides, ordered folders before unordered ones', () => {
    const entries: RawEntry[] = [
      { path: 'zzz-folder', kind: 'directory' },
      { path: 'guides', kind: 'directory' },
      { path: 'guides/installation.md', kind: 'file' },
    ]
    const folderMeta = new Map<string, FolderMeta>([['guides', { title: 'Guides', order: 1 }]])
    const tree = buildDocTree(entries, folderMeta)

    // "guides" has an explicit order so it sorts before "zzz-folder", which has none,
    // even though "zzz-folder" would otherwise come after alphabetically anyway —
    // the meaningful case is order winning over an alphabetically-earlier unordered sibling.
    expect(tree.map((n) => n.path)).toEqual(['guides', 'zzz-folder'])
    expect(tree[0].name).toBe('Guides')
  })

  it('places ordered folders before unordered siblings that would otherwise sort first', () => {
    const entries: RawEntry[] = [
      { path: 'aaa-unordered', kind: 'directory' },
      { path: 'guides', kind: 'directory' },
    ]
    const folderMeta = new Map<string, FolderMeta>([['guides', { order: 1 }]])
    const tree = buildDocTree(entries, folderMeta)
    expect(tree.map((n) => n.path)).toEqual(['guides', 'aaa-unordered'])
  })

  it('applies frontmatter-derived file order, ordered files before unordered ones', () => {
    const entries: RawEntry[] = [
      { path: 'zebra.md', kind: 'file' },
      { path: 'alpha.md', kind: 'file' },
    ]
    const fileOrder = new Map<string, number>([['zebra.md', 1]])
    const tree = buildDocTree(entries, new Map(), fileOrder)
    expect(tree.map((n) => n.path)).toEqual(['zebra.md', 'alpha.md'])
  })

  it('sorts ordered files and folders together by their shared order field', () => {
    const entries: RawEntry[] = [
      { path: 'later.md', kind: 'file' },
      { path: 'guides', kind: 'directory' },
      { path: 'first.md', kind: 'file' },
    ]
    const folderMeta = new Map<string, FolderMeta>([['guides', { order: 2 }]])
    const fileOrder = new Map<string, number>([
      ['first.md', 1],
      ['later.md', 3],
    ])
    const tree = buildDocTree(entries, folderMeta, fileOrder)
    expect(tree.map((n) => n.path)).toEqual(['first.md', 'guides', 'later.md'])
  })

  it('applies file order within a nested folder', () => {
    const entries: RawEntry[] = [
      { path: 'guides', kind: 'directory' },
      { path: 'guides/zebra.md', kind: 'file' },
      { path: 'guides/alpha.md', kind: 'file' },
    ]
    const fileOrder = new Map<string, number>([['guides/zebra.md', 1]])
    const tree = buildDocTree(entries, new Map(), fileOrder)
    const guides = tree.find((n) => n.path === 'guides')
    expect(guides?.children?.map((c) => c.path)).toEqual(['guides/zebra.md', 'guides/alpha.md'])
  })

  it('is a no-op when fileOrder is omitted (backward-compatible default)', () => {
    const entries: RawEntry[] = [
      { path: 'zebra.md', kind: 'file' },
      { path: 'alpha.md', kind: 'file' },
    ]
    expect(buildDocTree(entries, new Map()).map((n) => n.path)).toEqual(['alpha.md', 'zebra.md'])
  })

  it('handles multi-level nesting', () => {
    const entries: RawEntry[] = [
      { path: 'guides', kind: 'directory' },
      { path: 'guides/advanced', kind: 'directory' },
      { path: 'guides/advanced/deep.md', kind: 'file' },
    ]
    const tree = buildDocTree(entries, new Map())
    expect(tree[0].path).toBe('guides')
    expect(tree[0].children?.[0].path).toBe('guides/advanced')
    expect(tree[0].children?.[0].children?.[0].path).toBe('guides/advanced/deep.md')
  })
})
