import { useState, type ReactElement } from 'react'
import type { ConditionsFile } from '../../core/workspace/types'
import type { BlockAction } from './blockEditing'
import type { TokenCompletionItems } from './completions'
import { BulletListIcon, NumberedListIcon } from './listIcons'

type MenuKey = 'var' | 'snpt' | 'con' | 'lists' | 'block'

interface InsertToolbarProps {
  completionItems: TokenCompletionItems
  conditionsFile: ConditionsFile
  onInsertText: (text: string) => void
  onInsertCondition: (dimension: string, value: string) => void
  onInsertBlock: (action: BlockAction) => void
}

// Phase 8f: block-insertion toolbar actions. Deliberately excludes headings —
// Refrain's title/H1 normalization rule lands in Phase 9a, and a heading
// toolbar action needs to be gated to a single document-title H1 once that
// rule exists (see BUILD_PLAN.md 8f), so it's left out here rather than
// added ungated.
const LIST_ACTIONS: { action: BlockAction; label: string; icon: () => ReactElement }[] = [
  { action: 'bullet-list', label: 'Bulleted list', icon: BulletListIcon },
  { action: 'numbered-list', label: 'Numbered list', icon: NumberedListIcon },
]

const OTHER_BLOCK_ACTIONS: { action: BlockAction; label: string }[] = [
  { action: 'blockquote', label: 'Blockquote' },
  { action: 'code-block', label: 'Code block' },
  { action: 'horizontal-rule', label: 'Horizontal rule' },
]

function ToolbarButton({
  label,
  isOpen,
  onToggle,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700 ${isOpen ? 'bg-gray-700' : ''}`}
      onClick={onToggle}
    >
      {label} ▾
    </button>
  )
}

function DropdownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-auto rounded border border-gray-600 bg-gray-800 p-2 text-left shadow-lg">
      {children}
    </div>
  )
}

export function InsertToolbar({ completionItems, conditionsFile, onInsertText, onInsertCondition, onInsertBlock }: InsertToolbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)

  function toggleMenu(menu: MenuKey) {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  function close() {
    setOpenMenu(null)
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

  const hasConditions = Object.values(conditionsFile).some((values) => values.length > 0)

  return (
    <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
      {openMenu !== null && <div className="fixed inset-0 z-10" onClick={close} />}
      <div className="relative z-20">
        <ToolbarButton label="Var" isOpen={openMenu === 'var'} onToggle={() => toggleMenu('var')} />
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
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton label="Snpt" isOpen={openMenu === 'snpt'} onToggle={() => toggleMenu('snpt')} />
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
        <ToolbarButton label="Con" isOpen={openMenu === 'con'} onToggle={() => toggleMenu('con')} />
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
          </DropdownPanel>
        )}
      </div>

      <div className="relative z-20">
        <ToolbarButton label="Lists" isOpen={openMenu === 'lists'} onToggle={() => toggleMenu('lists')} />
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
        <ToolbarButton label="Block" isOpen={openMenu === 'block'} onToggle={() => toggleMenu('block')} />
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
    </div>
  )
}
