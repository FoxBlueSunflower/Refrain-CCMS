import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, minimalSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { createTokenCompletionSource, type TokenCompletionItems } from './completions'

interface CodeMirrorEditorProps {
  /** Stable identity of the open file — the editor is rebuilt only when this changes. */
  path: string
  /** Read once, at view-construction time for this `path`. Later changes to
   *  this prop while `path` stays the same are intentionally ignored — the
   *  user's live edits are the source of truth, not a re-render. */
  initialValue: string
  onChange: (value: string) => void
  onSave: () => void
  /** Variables & snippets available for {{ and {{> autocomplete. Read live via a ref, not rebuilt per keystroke. */
  completionItems: TokenCompletionItems
}

export interface CodeMirrorEditorHandle {
  /** Inserts `text` at the current cursor position (or replaces the selection) and refocuses the editor. */
  insertAtCursor: (text: string) => void
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(function CodeMirrorEditor(
  { path, initialValue, onChange, onSave, completionItems },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const completionItemsRef = useRef(completionItems)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    completionItemsRef.current = completionItems
  }, [completionItems])

  useImperativeHandle(forwardedRef, () => ({
    insertAtCursor: (text: string) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        minimalSetup,
        markdown(),
        autocompletion({ override: [createTokenCompletionSource(() => completionItemsRef.current)] }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        keymap.of([
          ...completionKeymap,
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
          '&': { height: '100%', fontSize: '14px', backgroundColor: '#111827', color: '#e5e7eb' },
          '.cm-content': { caretColor: '#f9fafb' },
          '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f9fafb' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#374151' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
          '.cm-tooltip-autocomplete': { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' },
          '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#4c1d95', color: '#f3f4f6' },
          '.cm-completionDetail': { color: '#9ca3af', fontStyle: 'normal' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      viewRef.current = null
      view.destroy()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- initialValue is intentionally read once per `path`, not on every parent re-render
  }, [path])

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden" />
})
