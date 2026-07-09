# BUILD_PLAN.md — Phased Milestones
One phase ≈ one-to-few Claude Code sessions. Rules per phase: start in plan
mode → approve plan → build → run acceptance checks → commit → /clear.
Do not start a phase until the previous phase's acceptance list fully passes.

---

## PHASE 0 — Scaffold & Deploy Pipeline
Vite + React + TS + Tailwind project; vite-plugin-pwa; GitHub Action that
builds and deploys to GitHub Pages on push to main; placeholder app shell.
**Accept when:**
- [x] `npm run dev` and `npm run build` succeed
- [x] Pushing to main auto-publishes to the GitHub Pages URL
- [x] Browser offers "Install app"; installed app opens in its own window
- [x] README has a 3-line description + the live URL

## PHASE 1 — Workspace: open, read, create
Folder picker (File System Access API); persist permission handle in
IndexedDB; re-open flow ("reconnect to My Docs?"); file tree sidebar from
docs/ + snippets/; "New workspace" creates the SPEC.md sample workspace
(sample docs, snippets, variables.json, conditions.json, workspace.json).
**Accept when:**
- [x] First run: create-or-open flow works; sample workspace generated
- [x] Restart browser → one click reconnects; tree renders
- [x] Create/rename/delete a document updates real files on disk
- [x] Wiping site data loses NOTHING but the reconnect convenience (verify!)

## PHASE 2 — Editor
CodeMirror 6 markdown editor; frontmatter-aware; live preview pane
(markdown rendered, unresolved {{tokens}} shown as-is for now);
autosave on idle + explicit save; dirty-state indicator.
**Accept when:**
- [x] Open, edit, save documents and snippets; changes visible in Notepad
- [x] Preview updates live; no lost edits when switching files fast
- [x] A malformed frontmatter shows a friendly warning, never a crash

## PHASE 3 — Resolver core (variables + snippets)
src/core/resolver: substitute {{key}} from variables.json; transclude
{{> name}} (one nesting level; friendly error on deeper/missing/circular);
preview pane switches to RESOLVED rendering with subtle highlight on
substituted content. Editor autocomplete for {{ and {{> ; insert palette
listing variables & snippets with descriptions.
**Accept when:**
- [x] Unit tests: substitution, missing var, missing snippet, nested
      snippet, circular include, snippet-containing-variable — all pass
- [x] Autocomplete triggers on {{ and inserts correctly
- [x] Preview shows resolved output; errors render as inline notices

## PHASE 4 — Where-used index
src/core/indexer: scan workspace → map of snippet/variable/condition →
documents (write .app/index.json); Where-Used panel: pick a snippet or
variable, see every document using it, click to open; rebuild on save.
**Accept when:**
- [ ] Panel counts match reality on the sample workspace
- [ ] Edits update the index without full-app refresh
- [ ] Deleting .app/index.json self-heals on next launch (cache, not truth)

## PHASE 5 — Conditions + Publish
Parse :::when dimension=value blocks; publish profiles from workspace.json;
src/core/builder: resolve + filter per profile → static HTML site into
publish/ (sidebar nav from folder tree, per-page titles, client-side search,
print stylesheet for Ctrl+P → PDF); "Publish" button with profile picker.
**Accept when:**
- [ ] `internal` profile shows internal blocks; `public` omits them
- [ ] publish/ opens locally as a working site: nav, search, styling
- [ ] Unknown condition tag → build warning listing file + line
- [ ] Ctrl+P on a published page yields a clean printable PDF

## PHASE 6 — Snapshots & Change Digest
src/core/snapshots: on publish (and manual save-point), copy docs/,
snippets/, variables.json into .app/history/<timestamp>/; diff vs. previous
publish → CHANGELOG.md + optional "What's new" page in the published site;
publish-log.json; History panel with one-click restore (restore = copy
back, current state auto-snapshotted first).
**Accept when:**
- [ ] Two publishes produce an accurate added/updated/removed changelog
- [ ] Restore an old snapshot; nothing is ever destroyed in the process
- [ ] publish-log.json accumulates one entry per publish

### ★ INTERVIEW-READY MILESTONE
Demo script (≤5 min): open sample workspace → edit the warning-banner
snippet → Where-Used shows 7 affected docs → publish "public" → site opens,
banner updated everywhere → changelog written itself.
(Phase 5 alone is minimum-viable demo; Phase 6 is the wow.)

## PHASE 7 — Polish (post-interview, feedback-driven)
Empty states, error toasts, keyboard shortcuts, onboarding tour text,
first-run "put your workspace in a synced folder" nudge. License-key check
(LemonSqueezy) ONLY when actually selling — not before.
**Accept when:** a stranger completes create→edit→publish unaided.

---

## Session discipline (repeat every time)
1. `claude` in the repo → state which phase/sub-task
2. Shift+Tab → plan mode → read the plan → approve or redirect
3. After building: "run build and tests, fix failures"
4. Review the diff → commit → `/clear`
5. Two failed fix attempts on one bug → `/clear`, re-prompt with learnings
