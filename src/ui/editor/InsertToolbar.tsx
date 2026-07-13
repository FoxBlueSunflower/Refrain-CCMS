import { useState, type ReactElement, type ReactNode } from 'react'
import { isExternalHref } from '../../core/workspace/paths'
import type { ConditionsFile } from '../../core/workspace/types'
import type { BlockAction } from './blockEditing'
import type { TokenCompletionItems } from './completions'
import type { InlineAction } from './inlineEditing'
import { BulletListIcon, ChecklistIcon, NumberedListIcon } from './listIcons'
import { BlocksIcon, ConIcon, ListsIcon, SnptIcon, TxtIcon, VarGlyph } from './toolbarIcons'

type MenuKey = 'txt' | 'var' | 'snpt' | 'con' | 'lists' | 'block'

interface InsertToolbarProps {
  completionItems: TokenCompletionItems
  conditionsFile: ConditionsFile
  documentPaths: ReadonlySet<string>
  usesCount: number
  usedInCount: number
  onInsertText: (text: string) => void
  onInsertCondition: (dimension: string, value: string) => void
  onInsertBlock: (action: BlockAction) => void
  onInsertInline: (action: InlineAction) => void
  onInsertLink: (target: string) => void
  onOpenVariables: () => void
  onOpenConditions: () => void
  onOpenWhereUsed: () => void
}

const INLINE_ACTIONS: { action: InlineAction; label: string; className: string }[] = [
  { action: 'bold', label: 'Bold', className: 'font-bold' },
  { action: 'italic', label: 'Italic', className: 'italic' },
  { action: 'underline', label: 'Underline', className: 'underline' },
]

const LIST_ACTIONS: { action: BlockAction; label: string; icon: () => ReactElement }[] = [
  { action: 'bullet-list', label: 'Bulleted list', icon: BulletListIcon },
  { action: 'numbered-list', label: 'Numbered list', icon: NumberedListIcon },
  { action: 'checklist', label: 'Checklist', icon: ChecklistIcon },
]

const OTHER_BLOCK_ACTIONS: { action: BlockAction; label: string }[] = [
  { action: 'blockquote', label: 'Blockquote' },
  { action: 'code-block', label: 'Code block' },
  { action: 'horizontal-rule', label: 'Horizontal rule' },
  { action: 'table', label: 'Table' },
  { action: 'space', label: 'Space' },
]

function ToolbarButton({
  icon,
  accessibleLabel,
  isOpen,
  onToggle,
}: {
  icon: ReactNode
  accessibleLabel: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 rounded border border-gray-600 px-1.5 py-0.5 text-gray-300 hover:bg-gray-700 ${isOpen ? 'bg-gray-700' : ''}`}
      onClick={onToggle}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      {icon}
      <span className="text-[10px] text-gray-400" aria-hidden="true">
        ▾
      </span>
    </button>
  )
}

/**
 * The free-text link field is documented (via its placeholder) as being for
 * external URLs — internal doc links have their own picker list below it.
 * Users commonly paste/type a bare domain without a scheme (e.g.
 * "example.com"); without a scheme, classifyLink can't tell that's external
 * and misclassifies it as a broken internal link. Only this field's raw
 * input gets normalized — doc-path buttons pass real relative paths straight
 * to insertLink and must stay untouched.
 */
function normalizeExternalTarget(target: string): string {
  if (target.startsWith('#') || target.startsWith('/') || target.startsWith('.') || target.endsWith('.md') || isExternalHref(target)) {
    return target
  }
  return `https://${target}`
}

function DropdownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-auto rounded border border-gray-600 bg-gray-800 p-2 text-left shadow-lg">
      {children}
    </div>
  )
}

export function InsertToolbar({
  completionItems,
  conditionsFile,
  documentPaths,
  usesCount,
  usedInCount,
  onInsertText,
  onInsertCondition,
  onInsertBlock,
  onInsertInline,
  onInsertLink,
  onOpenVariables,
  onOpenConditions,
  onOpenWhereUsed,
}: InsertToolbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [txtView, setTxtView] = useState<'menu' | 'link'>('menu')
  const [linkDraft, setLinkDraft] = useState('')

  function toggleMenu(menu: MenuKey) {
    setOpenMenu((current) => (current === menu ? null : menu))
    setTxtView('menu')
    setLinkDraft('')
  }

  function close() {
    setOpenMenu(null)
    setTxtView('menu')
    setLinkDraft('')
  }

  function insertText(text: string) {
    onInsertText(text)
    close()
  }

  function insertCondition(dimension: string, value: string) {
    onInsertCondition(dimension, value)
    close()
  }

  function insertBlock(action: BlockAction) {
    onInsertBlock(action)
    close()
  }

  function insertInline(action: InlineAction) {
    onInsertInline(action)
    close()
  }

  function insertLink(target: string) {
    const trimmed = target.trim()
    if (trimmed.length === 0) return
    onInsertLink(trimmed)
    close()
  }

  function openVariables() {
    onOpenVariables()
    close()
  }

  function openConditions() {
    onOpenConditions()
    close()
  }

  const hasConditions = Object.values(conditionsFile).some((values) => values.length > 0)

  return (
    <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
      {openMenu !== null && <div className="fixed inset-0 z-10" onClick={close} />}
      <div className="relative z-20">
        <ToolbarButton icon={<TxtIcon />} accessibleLabel="Txt" isOpen={openMenu === 'txt'} onToggle={() => toggleMenu('txt')} />
        {openMenu === 'txt' && (
          <DropdownPanel>
            {txtView === 'menu' && (
              <>
                {INLINE_ACTIONS.map(({ action, label, className }) => (
                  <button
                    key={action}
                    type="button"
                    className={`block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700 ${className}`}
                    onClick={() => insertInline(action)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                  onClick={() => insertBlock('subheading')}
                >
                  Subheading
                </button>
                <button
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                  onClick={() => setTxtView('link')}
                >
                  Link ▸
                </button>
              </>
            )}
            {txtView === 'link' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="w-fit rounded px-1 py-0.5 text-left text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                  onClick={() => setTxtView('menu')}
                >
                  ◂ Back
                </button>
                <form
                  className="flex gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const trimmed = linkDraft.trim()
                    insertLink(trimmed.length === 0 ? trimmed : normalizeExternalTarget(trimmed))
                  }}
                >
                  <input
                    type="text"
                    autoFocus
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    placeholder="https://example.com"
                    className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-0.5 text-xs text-gray-100 focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    Insert
                  </button>
                </form>
                {documentPaths.size > 0 && (
                  <>
                    <p className="px-1 text-xs text-gray-400">Or link to a document:</p>
                    {[...documentPaths].sort().map((docPath) => (
                      <button
                        key={docPath}
                        type="button"
                        className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                        onClick={() => insertLink(docPath)}
                      >
                        {docPath}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton icon={<ListsIcon />} accessibleLabel="Lists" isOpen={openMenu === 'lists'} onToggle={() => toggleMenu('lists')} />
        {openMenu === 'lists' && (
          <DropdownPanel>
            {LIST_ACTIONS.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                type="button"
                className="flex w-full items-center gap-2 truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => insertBlock(action)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton icon={<BlocksIcon />} accessibleLabel="Blocks" isOpen={openMenu === 'block'} onToggle={() => toggleMenu('block')} />
        {openMenu === 'block' && (
          <DropdownPanel>
            {OTHER_BLOCK_ACTIONS.map(({ action, label }) => (
              <button
                key={action}
                type="button"
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => insertBlock(action)}
              >
                {label}
              </button>
            ))}
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton icon={<SnptIcon />} accessibleLabel="Snpt" isOpen={openMenu === 'snpt'} onToggle={() => toggleMenu('snpt')} />
        {openMenu === 'snpt' && (
          <DropdownPanel>
            {completionItems.snippets.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">No snippets yet.</p>}
            {completionItems.snippets.map((s) => (
              <button
                key={s.key}
                type="button"
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                title={s.description}
                onClick={() => insertText(`{{> ${s.key}}}`)}
              >
                {`{{> ${s.key}}}`}
                {s.description && <span className="ml-2 text-xs text-gray-400">{s.description}</span>}
              </button>
            ))}
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton icon={<VarGlyph />} accessibleLabel="Var" isOpen={openMenu === 'var'} onToggle={() => toggleMenu('var')} />
        {openMenu === 'var' && (
          <DropdownPanel>
            {completionItems.variables.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">No variables yet.</p>}
            {completionItems.variables.map((v) => (
              <button
                key={v.key}
                type="button"
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                title={v.description}
                onClick={() => insertText(`{{${v.key}}}`)}
              >
                {`{{${v.key}}}`}
                {v.description && <span className="ml-2 text-xs text-gray-400">{v.description}</span>}
              </button>
            ))}
            <div className="my-1 border-t border-gray-700" />
            <button
              type="button"
              className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
              onClick={openVariables}
            >
              Edit variables…
            </button>
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton icon={<ConIcon />} accessibleLabel="Con" isOpen={openMenu === 'con'} onToggle={() => toggleMenu('con')} />
        {openMenu === 'con' && (
          <DropdownPanel>
            {!hasConditions && <p className="px-2 py-1 text-xs text-gray-400">No condition values yet.</p>}
            {Object.entries(conditionsFile).flatMap(([dimension, values]) =>
              values.map((value) => (
                <button
                  key={`${dimension}=${value}`}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
                  onClick={() => insertCondition(dimension, value)}
                >
                  {`:::when ${dimension}=${value}`}
                </button>
              )),
            )}
            <div className="my-1 border-t border-gray-700" />
            <button
              type="button"
              className="block w-full truncate rounded px-2 py-1 text-left text-sm text-gray-200 hover:bg-gray-700"
              onClick={openConditions}
            >
              Edit conditions…
            </button>
          </DropdownPanel>
        )}
      </div>

      <span className="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400">Uses {usesCount}</span>

      <button
        type="button"
        className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700"
        onClick={onOpenWhereUsed}
      >
        Used in {usedInCount}
      </button>
    </div>
  )
}
