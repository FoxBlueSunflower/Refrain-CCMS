import { useState } from 'react'
import { requestPermission } from '../../fs'

interface ReconnectPromptProps {
  handle: FileSystemDirectoryHandle
  onGranted: () => void
  onPickInstead: () => void
}

export function ReconnectPrompt({ handle, onGranted, onPickInstead }: ReconnectPromptProps) {
  const [denied, setDenied] = useState(false)

  async function handleReconnect() {
    const result = await requestPermission(handle, 'readwrite')
    if (result === 'granted') {
      onGranted()
    } else {
      setDenied(true)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold">Refrain</h1>
      <p className="text-gray-600">
        Reconnect to &ldquo;{handle.name}&rdquo;?
      </p>
      {denied && (
        <p className="max-w-md text-sm text-red-600">Permission was denied. Choose a folder to continue.</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
          onClick={() => void handleReconnect()}
        >
          Reconnect
        </button>
        <button
          type="button"
          className="rounded border border-gray-300 px-4 py-2 text-violet-700 hover:bg-violet-50"
          onClick={onPickInstead}
        >
          Choose a different folder
        </button>
      </div>
    </main>
  )
}
