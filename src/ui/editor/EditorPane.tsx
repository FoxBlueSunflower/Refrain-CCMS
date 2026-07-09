import { CodeMirrorEditor } from './CodeMirrorEditor'
import { PreviewPane } from './PreviewPane'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface EditorPaneProps {
  title: string
  path: string
  initialValue: string
  liveText: string
  dirty: boolean
  saveStatus: SaveStatus
  error: string | null
  currentRelPath: string | null
  onChange: (text: string) => void
  onSave: () => void
  onNavigate: (relPath: string) => void
}

function statusLabel(dirty: boolean, saveStatus: SaveStatus): { text: string; className: string } {
  if (saveStatus === 'saving') return { text: 'Saving…', className: 'text-gray-400' }
  if (saveStatus === 'error') return { text: 'Save failed', className: 'text-red-400' }
  if (dirty) return { text: 'Unsaved', className: 'text-amber-400' }
  return { text: 'Saved', className: 'text-gray-400' }
}

export function EditorPane({
  title,
  path,
  initialValue,
  liveText,
  dirty,
  saveStatus,
  error,
  currentRelPath,
  onChange,
  onSave,
  onNavigate,
}: EditorPaneProps) {
  const status = statusLabel(dirty, saveStatus)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-800">
      <header className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium text-gray-200">{title}</h1>
        <span className={`shrink-0 text-xs ${status.className}`}>{status.text}</span>
      </header>
      {error && <p className="border-b border-gray-700 px-4 py-2 text-sm text-red-400">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 border-r border-gray-700">
          <CodeMirrorEditor path={path} initialValue={initialValue} onChange={onChange} onSave={onSave} />
        </div>
        <div className="min-h-0 flex-1">
          <PreviewPane text={liveText} currentRelPath={currentRelPath} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  )
}
