import { useEffect, useRef } from 'react'
import { EditorView, minimalSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'

interface CodeMirrorEditorProps {
  /** Stable identity of the open file — the editor is rebuilt only when this changes. */
  path: string
  /** Read once, at view-construction time for this `path`. Later changes to
   *  this prop while `path` stays the same are intentionally ignored — the
   *  user's live edits are the source of truth, not a re-render. */
  initialValue: string
  onChange: (value: string) => void
  onSave: () => void
}

export function CodeMirrorEditor({ path, initialValue, onChange, onSave }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        minimalSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              onSaveRef.current()
              return true
            },
          },
        ]),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })

    return () => {
      view.destroy()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- initialValue is intentionally read once per `path`, not on every parent re-render
  }, [path])

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden" />
}
