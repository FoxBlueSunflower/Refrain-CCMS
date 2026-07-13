import { describe, expect, it } from 'vitest'
import { getNodeAt, indentNode, insertNode, moveNode, outdentNode, removeNode, renameHeading } from './edit'
import type { PublicationNode } from './types'

function doc(ref: string, children?: PublicationNode[]): PublicationNode {
  return children ? { type: 'doc', ref, children } : { type: 'doc', ref }
}

function heading(title: string, children?: PublicationNode[]): PublicationNode {
  return children ? { type: 'heading', title, children } : { type: 'heading', title }
}

describe('getNodeAt', () => {
  it('reads a root node', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md')]
    expect(getNodeAt(nodes, [1])).toEqual(doc('docs/b.md'))
  })

  it('reads a nested node', () => {
    const nodes = [heading('H', [doc('docs/a.md'), doc('docs/b.md')])]
    expect(getNodeAt(nodes, [0, 1])).toEqual(doc('docs/b.md'))
  })

  it('returns undefined for an out-of-range path', () => {
    const nodes = [doc('docs/a.md')]
    expect(getNodeAt(nodes, [5])).toBeUndefined()
  })

  it('returns undefined for an empty path', () => {
    expect(getNodeAt([doc('docs/a.md')], [])).toBeUndefined()
  })
})

describe('removeNode', () => {
  it('removes a root node', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md')]
    expect(removeNode(nodes, [0])).toEqual([doc('docs/b.md')])
  })

  it('removes a nested node, preserving the rest of the subtree', () => {
    const nodes = [heading('H', [doc('docs/a.md'), doc('docs/b.md')])]
    expect(removeNode(nodes, [0, 0])).toEqual([heading('H', [doc('docs/b.md')])])
  })

  it('removing a heading removes its whole subtree', () => {
    const nodes = [heading('H', [doc('docs/a.md')]), doc('docs/b.md')]
    expect(removeNode(nodes, [0])).toEqual([doc('docs/b.md')])
  })

  it('removes a node nested under a doc, preserving the rest of that doc\'s subtree', () => {
    const nodes = [doc('docs/a.md', [doc('docs/b.md'), doc('docs/c.md')])]
    expect(removeNode(nodes, [0, 0])).toEqual([doc('docs/a.md', [doc('docs/c.md')])])
  })

  it('is a no-op for a path that does not resolve', () => {
    const nodes = [doc('docs/a.md')]
    expect(removeNode(nodes, [3])).toEqual(nodes)
  })
})

describe('insertNode', () => {
  it('inserts at the root', () => {
    const nodes = [doc('docs/a.md')]
    expect(insertNode(nodes, [], 1, doc('docs/b.md'))).toEqual([doc('docs/a.md'), doc('docs/b.md')])
  })

  it('inserts as a child of a heading', () => {
    const nodes = [heading('H', [doc('docs/a.md')])]
    expect(insertNode(nodes, [0], 1, doc('docs/b.md'))).toEqual([heading('H', [doc('docs/a.md'), doc('docs/b.md')])])
  })

  it('inserts as the first child of an empty heading', () => {
    const nodes = [heading('H')]
    expect(insertNode(nodes, [0], 0, doc('docs/a.md'))).toEqual([heading('H', [doc('docs/a.md')])])
  })

  it('clamps an out-of-range index to the end', () => {
    const nodes = [doc('docs/a.md')]
    expect(insertNode(nodes, [], 99, doc('docs/b.md'))).toEqual([doc('docs/a.md'), doc('docs/b.md')])
  })

  it('inserts as a child of a doc node', () => {
    const nodes = [doc('docs/a.md')]
    expect(insertNode(nodes, [0], 0, doc('docs/b.md'))).toEqual([doc('docs/a.md', [doc('docs/b.md')])])
  })
})

describe('moveNode', () => {
  it('reorders within the same sibling list', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md'), doc('docs/c.md')]
    expect(moveNode(nodes, [0], [], 2)).toEqual([doc('docs/b.md'), doc('docs/c.md'), doc('docs/a.md')])
  })

  it('nests a root doc into a heading that comes after it', () => {
    const nodes = [doc('docs/a.md'), heading('H', [doc('docs/b.md')])]
    expect(moveNode(nodes, [0], [1], 0)).toEqual([heading('H', [doc('docs/a.md'), doc('docs/b.md')])])
  })

  it('nests a root doc into another doc that comes after it', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md', [doc('docs/c.md')])]
    expect(moveNode(nodes, [0], [1], 0)).toEqual([doc('docs/b.md', [doc('docs/a.md'), doc('docs/c.md')])])
  })

  it('nests a root doc into a heading that comes before it (index shift on removal)', () => {
    const nodes = [heading('H', [doc('docs/a.md')]), doc('docs/b.md')]
    expect(moveNode(nodes, [1], [0], 1)).toEqual([heading('H', [doc('docs/a.md'), doc('docs/b.md')])])
  })

  it('moves a node out of a heading back to root, after a later root sibling (index shift on removal)', () => {
    const nodes = [heading('H', [doc('docs/a.md')]), doc('docs/b.md'), doc('docs/c.md')]
    expect(moveNode(nodes, [0, 0], [], 2)).toEqual([
      heading('H', []),
      doc('docs/b.md'),
      doc('docs/a.md'),
      doc('docs/c.md'),
    ])
  })

  it('moves a heading with children as a unit, preserving the subtree', () => {
    const nodes = [heading('H', [doc('docs/a.md'), doc('docs/b.md')]), doc('docs/c.md')]
    expect(moveNode(nodes, [0], [], 1)).toEqual([doc('docs/c.md'), heading('H', [doc('docs/a.md'), doc('docs/b.md')])])
  })

  it('refuses to nest a heading inside its own subtree', () => {
    const nodes = [heading('H', [doc('docs/a.md')])]
    expect(moveNode(nodes, [0], [0, 0], 0)).toEqual(nodes)
  })

  it('is a no-op when fromPath does not resolve', () => {
    const nodes = [doc('docs/a.md')]
    expect(moveNode(nodes, [5], [], 0)).toEqual(nodes)
  })
})

describe('indentNode', () => {
  it('reparents a node as the last child of its preceding heading sibling', () => {
    const nodes = [heading('H', [doc('docs/a.md')]), doc('docs/b.md')]
    expect(indentNode(nodes, [1])).toEqual([heading('H', [doc('docs/a.md'), doc('docs/b.md')])])
  })

  it('is a no-op at index 0 (no preceding sibling)', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md')]
    expect(indentNode(nodes, [0])).toEqual(nodes)
  })

  it('reparents a node as the last child of its preceding doc sibling', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md')]
    expect(indentNode(nodes, [1])).toEqual([doc('docs/a.md', [doc('docs/b.md')])])
  })

  it('indents into an already-nested heading, using a nested path', () => {
    const nodes = [heading('Outer', [heading('Inner', [doc('docs/a.md')]), doc('docs/b.md')])]
    expect(indentNode(nodes, [0, 1])).toEqual([heading('Outer', [heading('Inner', [doc('docs/a.md'), doc('docs/b.md')])])])
  })
})

describe('renameHeading', () => {
  it('renames a root heading', () => {
    const nodes = [heading('Old')]
    expect(renameHeading(nodes, [0], 'New')).toEqual([heading('New')])
  })

  it('renames a nested heading, preserving its children', () => {
    const nodes = [heading('Outer', [heading('Old', [doc('docs/a.md')])])]
    expect(renameHeading(nodes, [0, 0], 'New')).toEqual([heading('Outer', [heading('New', [doc('docs/a.md')])])])
  })

  it('is a no-op when the path resolves to a doc node', () => {
    const nodes = [doc('docs/a.md')]
    expect(renameHeading(nodes, [0], 'New')).toEqual(nodes)
  })

  it('renames a heading nested beneath a doc', () => {
    const nodes = [doc('docs/a.md', [heading('Old')])]
    expect(renameHeading(nodes, [0, 0], 'New')).toEqual([doc('docs/a.md', [heading('New')])])
  })

  it('is a no-op for a path that does not resolve', () => {
    const nodes = [heading('H')]
    expect(renameHeading(nodes, [3], 'New')).toEqual(nodes)
  })
})

describe('outdentNode', () => {
  it('moves a nested node to become a sibling right after its parent', () => {
    const nodes = [heading('H', [doc('docs/a.md')]), doc('docs/b.md')]
    expect(outdentNode(nodes, [0, 0])).toEqual([heading('H', []), doc('docs/a.md'), doc('docs/b.md')])
  })

  it('is a no-op at the root', () => {
    const nodes = [doc('docs/a.md'), doc('docs/b.md')]
    expect(outdentNode(nodes, [0])).toEqual(nodes)
  })

  it('outdents from a doubly-nested position by one level', () => {
    const nodes = [heading('Outer', [heading('Inner', [doc('docs/a.md')])])]
    expect(outdentNode(nodes, [0, 0, 0])).toEqual([heading('Outer', [heading('Inner', []), doc('docs/a.md')])])
  })
})
