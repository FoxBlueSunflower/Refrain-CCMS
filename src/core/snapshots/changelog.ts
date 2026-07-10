import type { PublishLogEntry } from './types'

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatEntryDate(at: string): string {
  const date = new Date(at)
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const minutes = pad(date.getUTCMinutes())
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function renderEntry(entry: PublishLogEntry): string {
  const heading = `## ${formatEntryDate(entry.at)} — ${entry.profile}`
  const { added, updated, removed } = entry.changes
  if (added.length === 0 && updated.length === 0 && removed.length === 0) {
    return `${heading}\n- No changes.`
  }
  const lines = [
    ...added.map((path) => `- Added: ${path}`),
    ...updated.map((path) => `- Updated: ${path}`),
    ...removed.map((path) => `- Removed: ${path}`),
  ]
  return `${heading}\n${lines.join('\n')}`
}

/** Renders the full publish log as Markdown, most-recent-first, even though `log` is stored chronologically. */
export function renderChangelog(log: PublishLogEntry[]): string {
  const entries = [...log].reverse().map(renderEntry)
  const body = entries.length > 0 ? `\n\n${entries.join('\n\n')}` : ''
  return `# Changelog${body}\n`
}
