interface EmptyStateProps {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <p className="text-sm text-gray-400">{title}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {action && (
        <button
          type="button"
          className="rounded border border-violet-600 px-2 py-1 text-xs text-violet-300 hover:bg-violet-900/40"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
