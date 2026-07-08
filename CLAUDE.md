# CLAUDE.md — Project Memory

## What this is
A local-first, single-user content reuse tool for solo technical writers.
Runs entirely in the browser (PWA on GitHub Pages), reads/writes plain
markdown files in a user-chosen folder via the File System Access API.
No server. No accounts. No database. One-time purchase product.

Core value: write a snippet once, embed it in many docs, change it once,
see everywhere it's used, publish a static HTML site from it.

## Authoritative docs (read before feature work)
- docs/SPEC.md — feature scope, workspace file format, syntax rules
- docs/BUILD_PLAN.md — phased milestones with acceptance criteria
When SPEC.md and any instruction conflict, ask the user; SPEC.md usually wins.

## Stack (keep it this simple)
- Vite + React + TypeScript, Tailwind for styling
- CodeMirror 6 for the markdown editor
- vite-plugin-pwa for installability/offline
- No backend, no analytics, no localStorage/IndexedDB for CONTENT
  (content lives ONLY in the user's files; IndexedDB may hold folder
  permission handles and UI prefs — nothing else)
- Minimal dependencies; justify every new package in the commit message

## Commands
- npm run dev — local dev server
- npm run build — production build (must pass before any phase is "done")
- npm run test — unit tests (Vitest)
- Deploy: push to main → GitHub Action builds to Pages

## Architecture rules
- src/core/ — pure TypeScript modules, ZERO React/browser imports:
  resolver (variables/snippets/conditions), indexer (where-used),
  builder (static site), snapshots (history/changelog).
  These must stay framework-free — they will be reused in a future
  cloud version. Every core module gets unit tests.
- src/ui/ — thin React shell around core modules
- src/fs/ — the ONLY place File System Access API is touched
- Fail soft: file errors show a friendly message, never lose user text

## Syntax (fixed; do not invent alternatives)
- {{key}} = variable · {{> name}} = snippet include (max 1 level of nesting)
- :::when dimension=value ... ::: = conditional block
- Condition dimensions are ONLY 'audience' and 'output' — hard cap, on purpose

## Terminology (use these exact words in UI and code)
workspace · document · snippet · variable · condition · publish profile ·
snapshot · where-used
Never: "component", "block", "space", "org" (those belong to future products)

## Working style
- One BUILD_PLAN phase per session; use plan mode for multi-file changes
- Small commits with clear messages after each working step
- Run build + tests before declaring a task complete
- Chromium-only APIs are acceptable (documented product decision)
- When uncertain about product intent, ask — don't assume enterprise
  features are wanted; this product's discipline is staying small
