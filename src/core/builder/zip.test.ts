import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { BuiltFile } from './types'
import { buildZipArchive } from './zip'

describe('buildZipArchive', () => {
  it('places the home file at the archive root and content files under content/', () => {
    const homeFile: BuiltFile = { path: 'index.html', contents: '<h1>Home</h1>' }
    const contentFiles: BuiltFile[] = [
      { path: 'getting-started.html', contents: '<h1>Getting Started</h1>' },
      { path: 'guides/installation.html', contents: '<h1>Installation</h1>' },
    ]

    const archive = buildZipArchive(homeFile, contentFiles)
    const entries = unzipSync(archive)

    expect(Object.keys(entries).sort()).toEqual([
      'content/getting-started.html',
      'content/guides/installation.html',
      'index.html',
    ])
    expect(strFromU8(entries['index.html'])).toBe('<h1>Home</h1>')
    expect(strFromU8(entries['content/getting-started.html'])).toBe('<h1>Getting Started</h1>')
  })

  it('honors a custom content directory name', () => {
    const homeFile: BuiltFile = { path: 'index.html', contents: '<h1>Home</h1>' }
    const archive = buildZipArchive(homeFile, [{ path: 'a.html', contents: 'A' }], 'site')
    const entries = unzipSync(archive)
    expect(Object.keys(entries).sort()).toEqual(['index.html', 'site/a.html'])
  })
})
