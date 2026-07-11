import { useEffect, useState } from 'react'
import type { DocTreeNode } from '../../core/workspace/types'

/**
 * Fetches a DocTreeNode[] via `fetcher`, re-fetching whenever `handle` or
 * `refreshToken` changes. In-flight fetches are cancelled (their result
 * discarded) if a re-fetch starts or the component unmounts before they
 * resolve. Shared by Sidebar's document/snippet trees and the Templates panel.
 */
export function useDirTree(
  fetcher: (handle: FileSystemDirectoryHandle) => Promise<DocTreeNode[]>,
  handle: FileSystemDirectoryHandle,
  refreshToken?: number,
) {
  const [tree, setTree] = useState<DocTreeNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setTree(null)
    setError(null)
    fetcher(handle)
      .then((result) => {
        if (!cancelled) setTree(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, handle, refreshToken])

  return { tree, error }
}
