import { useMemo } from 'react'
import { marked } from 'marked'
import { parseFrontmatter } from '../../core/frontmatter/parse'

interface PreviewPaneProps {
  text: string
}

export function PreviewPane({ text }: PreviewPaneProps) {
  const parsed = useMemo(() => parseFrontmatter(text), [text])
  const html = useMemo(() => marked.parse(parsed.body, { async: false }), [parsed.body])

  return (
    <div className="h-full overflow-auto p-4">
      {parsed.warnings.length > 0 && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {parsed.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
