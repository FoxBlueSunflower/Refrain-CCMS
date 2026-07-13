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
- [x] Panel counts match reality on the sample workspace
- [x] Edits update the index without full-app refresh
- [x] Deleting .app/index.json self-heals on next launch (cache, not truth)

## PHASE 5 — Conditions + Publish
Parse :::when dimension=value blocks; publish profiles from workspace.json;
src/core/builder: resolve + filter per profile → static HTML site into
publish/ (sidebar nav from folder tree, per-page titles, client-side search,
print stylesheet for Ctrl+P → PDF); "Publish" button with profile picker.
**Update (multi-export/Home-page revision):** Publish no longer writes into
a workspace `publish/` folder — it zips the built site and prompts the user
to save it wherever they choose, with a generated Home page at the zip root
and the rest of the site under `content/` (see SPEC.md Part 2). This
replaces the "opens locally" acceptance bullet below.
**Accept when:**
- [x] `internal` profile shows internal blocks; `public` omits them
- [x] the exported zip opens locally as a working site: Home page, nav,
      search, styling all resolve correctly once unzipped
- [x] Unknown condition tag → build warning listing file + line
- [x] Ctrl+P on a published page yields a clean printable PDF

## PHASE 6 — Snapshots & Change Digest
src/core/snapshots: on publish (and manual save-point), copy docs/,
snippets/, variables.json into .app/history/<timestamp>/; diff vs. previous
publish → CHANGELOG.md + optional "What's new" page in the published site;
publish-log.json; History panel with one-click restore (restore = copy
back, current state auto-snapshotted first).
**Accept when:**
- [x] Two publishes produce an accurate added/updated/removed changelog
- [x] Restore an old snapshot; nothing is ever destroyed in the process
- [x] publish-log.json accumulates one entry per publish

### ★ INTERVIEW-READY MILESTONE
Demo script (≤5 min): open sample workspace → edit the warning-banner
snippet → Where-Used shows 7 affected docs → publish "public" → site opens,
banner updated everywhere → changelog written itself.
(Phase 5 alone is minimum-viable demo; Phase 6 is the wow.)

## PHASE 7 — Polish (post-interview, feedback-driven)
Empty states, error toasts, keyboard shortcuts, onboarding tour text,
first-run "put your workspace in a synced folder" nudge. Licensing is
Phase 10's job, not this phase's — see below.
**Accept when:** a stranger completes create→edit→publish unaided.

---

## BUILD_PLAN.md — Extension (Phases 8–13)
Same rules apply: plan mode → approve → build → acceptance checks → commit →
`/clear`. Don't start a phase until the previous phase's acceptance list
fully passes.

This extension covers three goals that sit beyond the Phase 7 interview
milestone:
1. **Round out the single-user product** with editor UX and a Paligo-style
   publication layer, both carried over from a parallel planning session
   for a Spaces-model fork of this tool, stripped of anything that needed
   a brand/cross-owner boundary to make sense (Phases 8–9)
2. **Sell it** as the one-time-purchase single-user product (Phase 10)
3. **Migrate it** into the cloud WeWeb/Supabase multi-user version that
   Open Eppic itself can eventually build on (Phases 11–13)

Phases 11-13 are the payoff of the architecture rule baked into CLAUDE.md
from day one: `src/core/` (resolver, indexer, builder, snapshots) has zero
React or browser imports specifically so it survives the jump to a server
context unchanged. If any core module needed a rewrite to migrate, that
would mean Phase 0-7 discipline slipped — check that first before writing
new code. Phase 9's publication object belongs in `src/core/` too, under
the same rule, so it migrates for free alongside everything else.

## PHASE 8 — Editor UI: forms + pills, and reusable templates
Four single-user-shaped features, carried over from the Spaces-prototype
planning session, stripped of anything brand/cross-owner related. Each
sub-part is independently buildable — don't treat this as one task.

### 8a. Frontmatter-as-collapsible-form
Replace the raw YAML/JSON frontmatter block with a structured form panel
above the body editor: collapsed by default once a doc has been saved
once (expand on click), expanded by default for new/empty docs. Known
keys (title, tags, status, etc.) render as real form inputs; unknown/
custom keys fall back to a simple key-value row so nothing is hidden or
silently dropped. The raw YAML remains the underlying file format — the
form is a view over it, so files stay plain-text and portable.
**Accept when:**
- [x] Editing via the form and editing the raw file (outside the app)
      produce identical results when the file is reopened
- [x] An unrecognized frontmatter key survives a round-trip without
      being dropped

### 8b. Variable pills
Inline rendering of `{{variable_name}}` references as visually distinct
pills, while the underlying saved file stays plain `{{variable_name}}`
text. Pill shows the variable's current resolved value on hover/click.
Typing `{{` triggers autocomplete across the whole workspace (no brand
scoping needed — the one simplification versus the prototype's version).
Broken references render as a distinct "broken pill" state, not a
silent failure.
**Accept when:**
- [x] Pills render correctly for both valid and broken references,
      visually distinct from each other
- [x] Underlying saved file content is unchanged plain-text — pills are
      a rendering layer only

### 8c. Snippet pills
Same pattern as 8b for `{{> snippet_name}}` references, with distinct
pill styling from variable pills.
**Accept when:**
- [x] Pills render correctly for both valid and broken references,
      visually distinct from each other
- [x] Underlying saved file content is unchanged plain-text — pills are
      a rendering layer only

### 8d. Doc and snippet templates
A template is the same shape as a doc/snippet but with placeholder
content instead of real content. "New from template" flow for both;
basic template management UI (list, edit, archive). No cross-brand
exception needed here — in a single-user workspace, every template is
just available everywhere, which is the natural behavior anyway.
**Accept when:**
- [x] Creating a doc/snippet from a template produces editable content
      correctly seeded from the template
- [x] Editing a doc created from a template never changes the template

### 8e. Highlight condition application (insertion)
Carried over from the original prioritized list — this was dropped by
mistake in an earlier pass of this doc and is restored here. UI sugar on
top of the existing `:::when dimension=value` syntax (already spec'd):
select text, apply a condition via a toolbar button or command palette
rather than hand-typing the block delimiters. Applied conditions render
as a distinct highlight/background color in the editor, with the
condition expression visible on hover, so a document with several
overlapping conditions stays legible at a glance rather than turning into
a wall of raw `:::` markers.
**Accept when:**
- [x] Selecting text and applying a condition via the UI produces byte-
      identical `:::when` syntax to typing it by hand
- [x] Applied conditions are visually highlighted and distinguishable
      from each other when multiple conditions exist in one document
- [x] Removing a condition via the UI cleanly restores plain text, no
      leftover delimiter fragments

### 8f. Block-insertion toolbar (lists, headings, etc.)
New scope, raised directly: basic block-level markdown affordances —
bulleted list, numbered list, blockquote, code block, horizontal rule —
insertable via toolbar button or `/`-style command palette, not just by
hand-typing markdown syntax. This is standard editor UX with no
condition/brand logic involved, so it's a clean fit here.

Scope this carefully — it's tempting to let "block editor" creep into a
much bigger rewrite (drag-to-reorder blocks, nested block types, a real
WYSIWYG model). That's out of scope for this sub-phase: the underlying
file format stays plain markdown text (per Refrain's core architecture
rule), and the toolbar is a convenience layer that inserts correct
markdown syntax at the cursor — not a structural editor rebuild. If a
true block-based editor is wanted later, that's a bigger, separate
decision (and arguably conflicts with the "content never touches browser
storage as anything but plain text" rule) — flag it rather than absorb it
here.
**Accept when:**
- [x] Each toolbar action inserts correct, valid markdown at the cursor
      (or wraps a selection correctly, e.g. blockquote)
- [x] Existing hand-typed markdown for the same constructs renders
      identically to toolbar-inserted versions — no divergent syntax paths
- [x] The heading toolbar option is limited to a single document-title H1
      (see Phase 9a) once Phase 9 is in place — it should NOT offer H2-H6
      as alternate "heading levels" for the title slot; H2-H6 remain
      available as ordinary body-structure markdown, not toolbar-promoted
      "heading" actions. Update: a single "Subheading" action (always H2,
      no level picker) shipped ahead of 9a per explicit user request — H1
      stays off the toolbar, still reserved for the future auto-managed
      title from 9a

### 8g. Link pills
Same pattern as 8b/8c for standard markdown `[text](url)` links, with
distinct pill styling from variable and snippet pills. External links and
internal doc-relative links both pill; internal links additionally get a
broken-link check (target document doesn't exist in docs/) since that's
verifiable locally, unlike external URLs.
**Accept when:**
- [x] Pills render correctly for external, valid-internal, and
      broken-internal links, visually distinct from each other and from
      variable/snippet pills
- [x] Underlying saved file content is unchanged plain-text — pills are
      a rendering layer only
- [x] A link whose text or URL contains a `{{variable}}`/`{{> snippet}}`
      token is left unpilled so the token inside still pills correctly

### 8h. Text formatting, checklist, table, link insertion
Raised directly: bold/italic/underline inline formatting and a "Link"
action (external URL or pick-a-document internal link) grouped under a
new "Txt" toolbar dropdown alongside Subheading; a "Checklist" action
added to the existing "Lists" dropdown; a "Table" action (fixed 2-column
GFM template) added to the block-level dropdown, relabeled "Blocks".
Underline has no native CommonMark syntax, so it inserts raw `<u>...</u>`
— verified safe since `marked` (used by both the live preview and the
static-site publisher) passes inline HTML through untouched.
**Accept when:**
- [x] Bold/italic/underline wrap the current selection, or leave the
      cursor between bare markers ready to type when nothing is selected
- [x] Link inserts `[text](target)`, using the selection as link text
      when present; the internal-link list is populated from the same
      known-document-paths set link pills already use for broken-link
      checks
- [x] Checklist and Table insert valid GFM (`- [ ] `, and a padded pipe
      table that doesn't merge into adjacent paragraph text)

---

## PHASE 9 — Publications (single-user Paligo layer)
The one bigger addition worth carrying over: an ordered-tree composition
layer above individual docs, minus the cross-brand composition that made
it a Spaces feature. Everything else here is a legitimate gap in
Refrain's original spec, which only ever planned single-document publish.

- **9a. Heading normalization.** Each doc has exactly one H1 — its title,
  the same title already carried in frontmatter — used as the doc's node
  label when it's placed in a publication tree. H2-H6 remain free-form
  for the doc's own internal structure; this rule is about there being a
  single, unambiguous *title* per doc for hierarchy purposes, not about
  limiting a doc to one heading total. Enforce (friendly warning, not a
  hard block) in the editor going forward.
- **9b. Publication object.** `publications/` folder; ordered tree of
  references to docs (not copies) — nodes can be docs, or
  structural-only headings that exist purely in the publication. Either
  kind may hold children: a doc can have sub-docs/sub-headings nested
  directly beneath it, not just headings — `heading` is only distinct in
  being content-free, not in being the sole nesting mechanism. See
  SPEC.md Part 2 for the file shape.
- **9c. Hierarchy assignment at publish time.** Resolver walks tree
  depth, assigns heading levels based on position (the doc's own H1
  becomes whatever level its tree depth implies; the doc's internal
  H2-H6 shift down to stay nested correctly beneath it). Condition-tag
  filtering happens BEFORE hierarchy assignment, so a filtered-out
  branch doesn't leave a hierarchy gap.
- **9d. Publication editor UI.** Drag-to-reorder, indent-to-nest, add
  structural heading, add doc reference, remove node.
- **9e. Doc where-used, extended.** Doc where-used now also lists every
  publication that includes it.

**Accept when:**
- [ ] A publication renders with correct, gap-free heading hierarchy
      after condition filtering
- [ ] Reordering/nesting is reflected correctly in output heading levels
- [ ] A doc's own internal H2-H6 structure remains intact and correctly
      re-nested under its assigned title level after publication
- [x] Doc where-used correctly lists all publications containing it
- [ ] Existing single-document publish still works unchanged for anyone
      who doesn't use publications — this stays additive, not a replacement

---

## PHASE 10 — Sell it (license gate + landing)
Only start this once Phase 7's "stranger completes create→edit→publish
unaided" bar is met by an actual outside tester, not just you. (Phases 8-9
can ship before or after this — they're not gating; sequenced first in
this doc because they were the more concrete asks.)

LemonSqueezy product + checkout; license-key input screen gates nothing in
the editor itself (data always stays local and usable — the gate only
blocks *new workspace creation* past a trial cap, e.g. 1 workspace / 10
documents free). Simple static landing page (GitHub Pages, same repo or a
`/site` subfolder) with the 5-minute demo script's beats turned into
screenshots + a 60-second capture. Webhook or manual key list (whichever
LemonSqueezy makes easier at this scale) checked client-side on launch.
**Accept when:**
- [ ] Trial cap enforced; entering a valid key removes it; invalid key
      shows a clear, non-blocking message (never destroys existing content)
- [ ] Landing page states the one-time price, what's local-only, and links
      to checkout; checkout → email with key works end to end (test mode)
- [ ] No license check exists inside `src/core/` — gate lives in `src/ui/`
      only, so core modules stay portable to Phase 11 untouched

---

## PHASE 11 — Migration script (folder → rows)
This is the phase the whole architecture was insurance for. Build the
importer described in SPEC.md's mapping table, run against Supabase, but
still *offline/CLI* — no server product yet, just proof the mapping holds.

`scripts/migrate-to-supabase.ts`: Node script, takes a workspace folder path
+ Supabase project credentials; walks the folder per the SPEC.md mapping
(documents → `documents` table, `snippets/` → `snippets` table,
`variables.json` → `variables` rows, `.app/history/` snapshots → `versions`
rows, publish-log.json → `publish_log` + `publish_log_entry` rows, plus
`publications/` → `publications` + `publication_nodes` rows per Phase 9's
tree structure);
single-user-id assumed (your own account) for this phase — multi-tenant
auth is Phase 12.
**Accept when:**
- [ ] Running the script against the SPEC.md sample workspace produces a
      Supabase project whose row counts match the source file counts exactly
      (N docs, N snippets, N variables, N snapshots — verify with a query)
- [ ] Re-running the script on an unchanged folder is a no-op (idempotent —
      no duplicate rows); re-running after an edit updates only what changed
- [ ] A resolved document pulled back out of Supabase renders identically
      to the local app's resolved preview for the same document (byte-diff
      the rendered HTML, not just eyeball it)
- [ ] Migration failures (bad frontmatter, orphaned snippet reference) list
      every offending file with a reason; nothing partially imports silently

---

## PHASE 12 — Cloud core: same modules, server context
Stand up a minimal Supabase schema (per the mapping table) + a thin API
layer (Supabase Edge Functions, or a small Node/Express service if Edge
Functions can't run the existing `src/core/` code as-is) that imports the
**same** resolver/indexer/builder/snapshot/publication modules from Phases
0-9, unmodified, now reading rows instead of files.

**This phase is a test of the architecture rule, not a rewrite.** If
`src/core/resolver.ts` needs changes to run server-side, treat that as a
bug in the original module (it had a hidden browser dependency) and fix it
minimally — don't fork the module into a client version and a server
version.
**Accept when:**
- [ ] `src/core/*` files are byte-identical (or near-identical, diffable)
      between the Phase 9 client app and the Phase 12 server service
- [ ] Given the same workspace data, resolver/indexer/builder produce
      identical output whether called from the browser app or the server
- [ ] Auth: Supabase Row-Level Security scopes every table to
      `auth.uid()` — one user cannot query another's documents even via
      direct API call (verify with a second test account, not just code review)
- [ ] Where-used index and publish still work against Supabase-backed data,
      exercised through a bare API client (Postman/curl), no UI yet

---

## PHASE 13 — Multi-user shell (WeWeb, or thin React if WeWeb can't fit it)
Wrap Phase 12's API in a real front end. Try WeWeb first since it's the
stated target; if WeWeb's component model can't reasonably host a
CodeMirror-based editor with live resolved preview, fall back to the
existing React `src/ui/` components pointed at the new API instead of the
File System Access layer — swap `src/fs/` for `src/api/`, keep `src/ui/`
otherwise intact.

Multi-tenant basics only: signup/login (Supabase Auth), one workspace per
account to start (org/team sharing is out of scope here — first real
scope decision for "OE-proper" territory, not this tool's job to solve).
**Accept when:**
- [ ] Two separate accounts, each with their own workspace, cannot see or
      modify each other's documents (re-verify RLS through the actual UI)
- [ ] Full loop works through the UI: sign up → create workspace → edit →
      where-used → publish (including a multi-doc publication) → change
      digest, matching Phases 0-9's local behavior feature-for-feature
- [ ] Existing local-app users can run the Phase 11 migration script and
      log into the cloud version to find their content intact
- [ ] A cost check: current Supabase + hosting spend at your expected
      account count stays under whatever monthly ceiling you set going in
      (flag explicitly if it doesn't — don't let this drift silently)

### ★ SECOND INTERVIEW-READY / SHIP-READY MILESTONE
Demo script: same 5-minute local demo, plus a coda — "and here's the same
tool, same data model, running multi-user in the cloud, because the core
logic never had to be rewritten." That sentence is the actual point of
Phases 0-9's discipline; Phase 13 is where it gets to be true out loud.

---

## What's deliberately NOT in this extension
- Team/org sharing, permissions beyond owner — first real Open Eppic-shaped
  decision (element ownership, derivative works) and shouldn't be
  backfilled into this tool's scope without deciding it's the same product
- Payment/subscription billing for the cloud version — Phase 10's
  one-time-purchase model doesn't automatically become a SaaS plan; that's
  a pricing decision to make deliberately, not inherit by default
- Anything from Open Eppic's actual schema (elements, works, revenue
  splits) — this tool stays a generic reuse engine; conflating it with the
  Open Eppic platform's domain model is the drift CLAUDE.md's terminology
  fence exists to prevent

---

## Session discipline (repeat every time)
1. `claude` in the repo → state which phase/sub-task
2. Shift+Tab → plan mode → read the plan → approve or redirect
3. After building: "run build and tests, fix failures"
4. Review the diff → commit → `/clear`
5. Two failed fix attempts on one bug → `/clear`, re-prompt with learnings
