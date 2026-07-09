import { useCallback, useEffect, useState } from 'react'
import { clearStoredWorkspaceHandle, getStoredWorkspaceHandle, looksLikeWorkspace, queryPermission, saveWorkspaceHandle } from '../fs'
import { ReconnectPrompt } from './workspace/ReconnectPrompt'
import { WorkspacePicker } from './workspace/WorkspacePicker'
import { WorkspaceShell } from './workspace/WorkspaceShell'

type AppState =
  | { status: 'checking' }
  | { status: 'no-workspace'; errorMessage?: string }
  | { status: 'reconnect-available'; handle: FileSystemDirectoryHandle }
  | { status: 'ready'; handle: FileSystemDirectoryHandle }

function App() {
  const [state, setState] = useState<AppState>({ status: 'checking' })

  const openHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    try {
      const isWorkspace = await looksLikeWorkspace(handle)
      if (!isWorkspace) {
        setState({
          status: 'no-workspace',
          errorMessage: `"${handle.name}" doesn't look like a Refrain workspace anymore. Pick a folder to continue.`,
        })
        return
      }
      await saveWorkspaceHandle(handle)
      setState({ status: 'ready', handle })
    } catch (error) {
      await clearStoredWorkspaceHandle()
      const detail = error instanceof Error ? error.message : String(error)
      setState({
        status: 'no-workspace',
        errorMessage: `We couldn't open "${handle.name}" (${detail}). It may have been moved or deleted — pick your workspace folder again.`,
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const handle = await getStoredWorkspaceHandle()
      if (cancelled) return
      if (!handle) {
        setState({ status: 'no-workspace' })
        return
      }

      const permission = await queryPermission(handle, 'readwrite')
      if (cancelled) return

      if (permission === 'granted') {
        await openHandle(handle)
        return
      }
      if (permission === 'prompt') {
        setState({ status: 'reconnect-available', handle })
        return
      }
      // 'denied': the old grant is gone for good, start over
      await clearStoredWorkspaceHandle()
      setState({ status: 'no-workspace' })
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [openHandle])

  if (state.status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        <p>Loading…</p>
      </main>
    )
  }

  if (state.status === 'no-workspace') {
    return <WorkspacePicker onConnected={(handle) => void openHandle(handle)} errorMessage={state.errorMessage} />
  }

  if (state.status === 'reconnect-available') {
    return (
      <ReconnectPrompt
        handle={state.handle}
        onGranted={() => void openHandle(state.handle)}
        onPickInstead={() => {
          void clearStoredWorkspaceHandle()
          setState({ status: 'no-workspace' })
        }}
      />
    )
  }

  return <WorkspaceShell handle={state.handle} />
}

export default App
