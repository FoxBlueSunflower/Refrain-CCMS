import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, minimalSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import type { ResolveContext } from '../../core/resolver/types'
import type { ConditionsFile } from '../../core/workspace/types'
import { createConditionCompletionSource, createTokenCompletionSource, type TokenCompletionItems } from './completions'
import { buildConditionInsertion } from './conditionEditing'
import { createConditionHighlightPlugin } from './conditionHighlightPlugin'
import { createLinkPillPlugin, createPillPlugin, refreshPillsEffect } from './pillPlugin'

// Overrides CodeMirror's default light-mode link/URL color (a dark indigo,
// `#219`), which is nearly illegible against this editor's dark background.
const editorHighlightStyle = HighlightStyle.define([
  { tag: [tags.url, tags.link], color: '#a5b4fc', textDecoration: 'underline' },
])

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
  /** Condition dimensions/values available for :::when autocomplete. Read live via a ref, not rebuilt per keystroke. */
  conditionsFile: ConditionsFile
  /** Variables & snippets used to render {{variable_name}} pills. Read live via a ref; changes also trigger an in-place pill refresh. */
  resolveContext: ResolveContext
  /** Relative to the workspace's docs/ folder; null when editing a snippet. Used to resolve relative links for link-pill broken checks. */
  currentRelPath: string | null
  /** All known document paths, relative to docs/, used to detect broken internal links. Read live via a ref; changes also trigger an in-place pill refresh. */
  documentPaths: ReadonlySet<string>
}

export interface CodeMirrorEditorHandle {
  /**
   * Inserts `text` at the current cursor position (or replaces the
   * selection) and refocuses the editor. The cursor lands after the
   * inserted text by default; pass `caretOffset` to land it partway through
   * instead (e.g. on a blank body line inside a multi-line template).
   */
  insertAtCursor: (text: string, caretOffset?: number) => void
  /**
   * Applies a ":::when dimension=value" condition to the current selection
   * (Phase 8e): wraps the selected text in bare fence lines, or — when
   * nothing is selected — inserts a blank scaffold, same as before.
   */
  wrapSelectionWithCondition: (dimension: string, value: string) => void
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(function CodeMirrorEditor(
  { path, initialValue, onChange, onSave, completionItems, conditionsFile, resolveContext, currentRelPath, documentPaths },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const completionItemsRef = useRef(completionItems)
  const conditionsFileRef = useRef(conditionsFile)
  const resolveContextRef = useRef(resolveContext)
  const currentRelPathRef = useRef(currentRelPath)
  const documentPathsRef = useRef(documentPaths)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    completionItemsRef.current = completionItems
  }, [completionItems])

  useEffect(() => {
    conditionsFileRef.current = conditionsFile
  }, [conditionsFile])

  useEffect(() => {
    resolveContextRef.current = resolveContext
    viewRef.current?.dispatch({ effects: refreshPillsEffect.of(null) })
  }, [resolveContext])

  useEffect(() => {
    currentRelPathRef.current = currentRelPath
    viewRef.current?.dispatch({ effects: refreshPillsEffect.of(null) })
  }, [currentRelPath])

  useEffect(() => {
    documentPathsRef.current = documentPaths
    viewRef.current?.dispatch({ effects: refreshPillsEffect.of(null) })
  }, [documentPaths])

  useImperativeHandle(forwardedRef, () => ({
    insertAtCursor: (text: string, caretOffset?: number) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + (caretOffset ?? text.length) },
      })
      view.focus()
    },
    wrapSelectionWithCondition: (dimension: string, value: string) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const { insertText, cursorPos } = buildConditionInsertion(view.state.doc.toString(), from, to, dimension, value)
      view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + cursorPos },
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
        syntaxHighlighting(editorHighlightStyle),
        autocompletion({
          override: [
            createTokenCompletionSource(() => completionItemsRef.current),
            createConditionCompletionSource(() => conditionsFileRef.current),
          ],
        }),
        createPillPlugin(() => resolveContextRef.current),
        createLinkPillPlugin(() => ({ currentRelPath: currentRelPathRef.current, documentPaths: documentPathsRef.current })),
        createConditionHighlightPlugin(),
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
          '.rf-pill': {
            borderRadius: '4px',
            padding: '0 4px',
            cursor: 'text',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.9em',
          },
          '.rf-pill-variable': { backgroundColor: '#312e81', color: '#c7d2fe', border: '1px solid #4c1d95' },
          '.rf-pill-snippet': { backgroundColor: '#134e4a', color: '#99f6e4', border: '1px solid #0f766e' },
          '.rf-pill-link': {
            backgroundColor: '#0c4a6e',
            color: '#7dd3fc',
            border: '1px solid #0369a1',
            display: 'inline-block',
            maxWidth: '240px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          },
          '.rf-pill-broken': { backgroundColor: '#450a0a', color: '#fca5a5', border: '1px dashed #b91c1c' },
          // Phase 8e: ":::when dimension=value ... :::" block highlight. Fence
          // lines are muted/small (so a document doesn't turn into a wall of
          // raw ::: markers) with a colored left border; body lines get a
          // full-width tinted background. Color is picked per dimension=value
          // tag from a small rotating palette (see conditionHighlightPlugin.ts)
          // so adjacent, differently-tagged blocks stay visually distinct.
          '.rf-condition-fence': {
            fontSize: '0.85em',
            color: '#9ca3af',
            borderLeftWidth: '3px',
            borderLeftStyle: 'solid',
            paddingLeft: '6px',
          },
          '.rf-condition-body': { borderLeftWidth: '3px', borderLeftStyle: 'solid', paddingLeft: '6px' },
          '.rf-condition-color-0.rf-condition-fence': { borderLeftColor: '#b45309' },
          '.rf-condition-color-0.rf-condition-body': { backgroundColor: '#451a0333', borderLeftColor: '#b45309' },
          '.rf-condition-color-1.rf-condition-fence': { borderLeftColor: '#a21caf' },
          '.rf-condition-color-1.rf-condition-body': { backgroundColor: '#4a044e33', borderLeftColor: '#a21caf' },
          '.rf-condition-color-2.rf-condition-fence': { borderLeftColor: '#65a30d' },
          '.rf-condition-color-2.rf-condition-body': { backgroundColor: '#1a2e0533', borderLeftColor: '#65a30d' },
          '.rf-condition-color-3.rf-condition-fence': { borderLeftColor: '#be123c' },
          '.rf-condition-color-3.rf-condition-body': { backgroundColor: '#4c051933', borderLeftColor: '#be123c' },
          '.rf-condition-remove': {
            marginLeft: '8px',
            padding: '0 4px',
            borderRadius: '4px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '0.8em',
          },
          '.rf-condition-remove:hover': { backgroundColor: '#374151', color: '#f3f4f6' },
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
