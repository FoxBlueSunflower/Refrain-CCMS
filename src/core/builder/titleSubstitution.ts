import { IDENTIFIER_CHARS } from '../workspace/identifier-keys'
import type { VariablesFile } from '../workspace/types'

const TITLE_TOKEN_PATTERN = new RegExp(`\\{\\{\\s*([${IDENTIFIER_CHARS}]+)\\s*\\}\\}`, 'g')

/**
 * Best-effort {{key}} substitution for short labels (page <title>/nav text,
 * a publication's structural heading titles): variables only, no snippets,
 * unresolved keys are left literal, and (unlike resolveDocument) this never
 * emits a warning — it's cosmetic, not content.
 */
export function substituteTitleVariables(title: string, variables: VariablesFile): string {
  return title.replace(TITLE_TOKEN_PATTERN, (match, key: string) => variables[key]?.value ?? match)
}
