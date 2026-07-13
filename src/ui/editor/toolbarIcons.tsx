/**
 * Trigger-button icons for the six InsertToolbar dropdowns (Txt, Lists,
 * Blocks, Snpt, Var, Con). Distinct from listIcons.tsx, which stays scoped
 * to the Lists dropdown's internal row icons (bullet/numbered/checklist).
 */

export function TxtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 3H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 3V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 13.5H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ListsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 4H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 8H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 12H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function BlocksIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="1.5" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9.5" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function SnptIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="1" width="12" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="6.5" width="12" height="3" rx="0.5" fill="currentColor" />
      <rect x="2" y="11.5" width="12" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function ConIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 1V15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 2H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 11H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 2H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 8H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function VarGlyph() {
  return (
    <span className="flex h-3.5 w-3.5 items-center justify-center font-mono text-[11px] leading-none" aria-hidden="true">
      (x)
    </span>
  )
}
