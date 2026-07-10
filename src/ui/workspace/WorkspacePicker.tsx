import { useState } from 'react'
import { createSampleWorkspace, looksLikeWorkspace, PickerCancelledError, pickWorkspaceFolder, saveWorkspaceHandle } from '../../fs'

interface WorkspacePickerProps {
  onConnected: (handle: FileSystemDirectoryHandle, opts?: { isNewSample: boolean }) => void
  errorMessage?: string
}

type PickerState =
  | { step: 'idle' }
  | { step: 'confirm-create'; handle: FileSystemDirectoryHandle }
  | { step: 'creating' }
  | { step: 'error'; message: string }

export function WorkspacePicker({ onConnected, errorMessage }: WorkspacePickerProps) {
  const [state, setState] = useState<PickerState>({ step: 'idle' })

  async function handleChooseFolder() {
    let handle: FileSystemDirectoryHandle
    try {
      handle = await pickWorkspaceFolder()
    } catch (error) {
      if (error instanceof PickerCancelledError) return
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }

    try {
      const isWorkspace = await looksLikeWorkspace(handle)
      if (isWorkspace) {
        await saveWorkspaceHandle(handle)
        onConnected(handle)
        return
      }
      setState({ step: 'confirm-create', handle })
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  async function handleCreateSample(handle: FileSystemDirectoryHandle) {
    setState({ step: 'creating' })
    try {
      await createSampleWorkspace(handle)
      await saveWorkspaceHandle(handle)
      onConnected(handle, { isNewSample: true })
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const bannerMessage = state.step === 'error' ? state.message : errorMessage

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 px-6 text-center">
      <h1 className="text-4xl font-semibold">Refrain</h1>
      <p className="text-gray-400">Content reuse for solo technical writers.</p>

      {bannerMessage && <p className="max-w-md text-sm text-red-400">{bannerMessage}</p>}

      {state.step === 'confirm-create' ? (
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-md text-sm text-gray-300">
            &ldquo;{state.handle.name}&rdquo; doesn&rsquo;t look like a Refrain workspace yet. Create a sample
            workspace here?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
              onClick={() => void handleCreateSample(state.handle)}
            >
              Create sample workspace
            </button>
            <button
              type="button"
              className="rounded border border-gray-600 px-4 py-2 text-violet-400 hover:bg-gray-700"
              onClick={() => setState({ step: 'idle' })}
            >
              Choose a different folder
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={state.step === 'creating'}
          className="rounded bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
          onClick={() => void handleChooseFolder()}
        >
          {state.step === 'creating' ? 'Setting up…' : 'Choose a folder'}
        </button>
      )}
    </main>
  )
}
