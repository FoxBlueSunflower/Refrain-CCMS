import { Sidebar } from './Sidebar'

interface WorkspaceShellProps {
  handle: FileSystemDirectoryHandle
}

export function WorkspaceShell({ handle }: WorkspaceShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar handle={handle} />
      <main className="flex flex-1 items-center justify-center text-gray-400">
        <p>Select a document</p>
      </main>
    </div>
  )
}
