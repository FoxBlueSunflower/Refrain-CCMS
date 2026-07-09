interface WorkspaceShellProps {
  handle: FileSystemDirectoryHandle
}

export function WorkspaceShell({ handle }: WorkspaceShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-200 p-4">
        <h2 className="mb-3 truncate text-sm font-semibold uppercase tracking-wide text-gray-500">{handle.name}</h2>
        <p className="text-sm text-gray-400">Loading documents…</p>
      </aside>
      <main className="flex flex-1 items-center justify-center text-gray-400">
        <p>Select a document</p>
      </main>
    </div>
  )
}
