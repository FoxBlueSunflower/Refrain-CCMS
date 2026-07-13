import { describe, expect, it } from 'vitest'
import type { DocTreeNode } from '../workspace/types'
import { buildNav, docPathToOutputPath, prefixNavHrefs } from './nav'
import type { NavNode } from './nav'

const noTitles = () => ''

describe('docPathToOutputPath', () => {
  it('replaces a .md extension with .html', () => {
    expect(docPathToOutputPath('guides/installation.md')).toBe('guides/installation.html')
  })
})

describe('buildNav', () => {
  it('builds a flat tree, marking the current page active', () => {
    const tree: DocTreeNode[] = [
      { kind: 'file', name: 'index', path: 'index.md' },
      { kind: 'file', name: 'getting-started', path: 'getting-started.md' },
    ]
    const nav = buildNav(tree, 'index.html', noTitles)
    expect(nav).toEqual([
      { kind: 'file', title: 'index', href: 'index.html', active: true },
      { kind: 'file', title: 'getting-started', href: 'getting-started.html', active: false },
    ])
  })

  it('preserves folder structure and computes page-relative hrefs at depth', () => {
    const tree: DocTreeNode[] = [
      { kind: 'file', name: 'index', path: 'index.md' },
      {
        kind: 'folder',
        name: 'Guides',
        path: 'guides',
        children: [{ kind: 'file', name: 'installation', path: 'guides/installation.md' }],
      },
    ]
    const nav = buildNav(tree, 'guides/installation.html', noTitles)
    expect(nav).toEqual([
      { kind: 'file', title: 'index', href: '../index.html', active: false },
      {
        kind: 'folder',
        title: 'Guides',
        children: [{ kind: 'file', title: 'installation', href: 'installation.html', active: true }],
      },
    ])
  })

  it('uses titleFor when it returns a non-empty title, falling back to the node name otherwise', () => {
    const tree: DocTreeNode[] = [{ kind: 'file', name: 'installation', path: 'guides/installation.md' }]
    const titled = buildNav(tree, 'index.html', () => 'Installing AcmeCloud')
    expect(titled[0]).toMatchObject({ title: 'Installing AcmeCloud' })

    const fallback = buildNav(tree, 'index.html', () => '')
    expect(fallback[0]).toMatchObject({ title: 'installation' })
  })
})

describe('prefixNavHrefs', () => {
  it('prepends the prefix to every file href and forces active off, recursing through folders', () => {
    const nodes: NavNode[] = [
      { kind: 'file', title: 'Home', href: 'index.html', active: true },
      {
        kind: 'folder',
        title: 'Guides',
        children: [{ kind: 'file', title: 'Installation', href: 'guides/installation.html', active: false }],
      },
    ]

    expect(prefixNavHrefs(nodes, 'content')).toEqual([
      { kind: 'file', title: 'Home', href: 'content/index.html', active: false },
      {
        kind: 'folder',
        title: 'Guides',
        children: [{ kind: 'file', title: 'Installation', href: 'content/guides/installation.html', active: false }],
      },
    ])
  })
})
