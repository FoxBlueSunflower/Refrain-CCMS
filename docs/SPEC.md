# LOCAL-FIRST BROWSER APP — SPEC v0.1
Working name context: single-user reuse engine for solo technical writers.
One-time price (~$29–49, LemonSqueezy license key). Chromium browsers. 
Distribution: static PWA on GitHub Pages. Data: plain files in a user-chosen folder.

---

## PART 1 — FEATURE SCOPE (the 15 scored features, re-cut for single-user)

### KEPT — the reuse core (the reason to pay)
| Feature | Single-user form | Why it survives |
|---|---|---|
| A2 Snippets | `snippets/` folder; embed with `{{> snippet-name}}`; live-update only | The category-defining feature. Fork-with-lineage kept (frontmatter field) |
| A3 Variables | `variables.json`; insert `{{key}}`; autocomplete in editor | Cheapest high-value feature in the rubric (+21) |
| A4 Conditional tags | `:::when audience=internal` fenced blocks; publish profiles choose what's included | The differentiator nothing cheap has. Dimensions and values are fully user-defined in-app — the format itself just enforces "tags only," no fixed vocabulary |
| A8 Where-used | Index panel: "warning-banner appears in 7 docs"; click-through; pre-publish impact list | The star screen (+24); locally it's just scanning files — nearly free |
| A7 Versioning | Automatic timestamped snapshots to `.app/history/` on publish + manual save-points; restore = copy back | Simple snapshot model; users with git get real VCS for free on top |
| A5 Publish | Client-side build → zip archive (sidebar nav + client search) saved wherever the user picks via the browser's save dialog | The output that makes it a product, not a notes app |
| B1 Change digest | Publish diff vs. last publish → `CHANGELOG.md` + optional "What's new" page in the site | Errata-engine DNA; trivial once snapshots exist |
| A9 Import/Export | Import = "put .md files in the folder." Export = the folder itself | Satisfied by architecture; zero build cost |
| B2 Ownership | Inherent: files on user's disk | The covenant, free |
| B4 Fast start | First-run creates a sample workspace demonstrating snippet/variable/condition | Conversion depends on the first 10 minutes |

### CHANGED — one big scope decision
| Feature | Change | Rationale |
|---|---|---|
| A1 Editor | **Markdown source editor + live preview** (CodeMirror), with autocomplete for `{{variables}}` and `{{> snippets}}` and one-click insert palette — NOT a block WYSIWYG | The $39 solo buyer is the markdown-comfortable writer (docs-as-code refugees, Obsidian crowd). WYSIWYG existed for SMEs — who aren't in a single-user product. This one cut removes the highest build-difficulty item in the rubric (7→~3) and most of the token cost you're worried about. WYSIWYG returns in the SaaS, where SMEs return |

### CUT — team features (return in the SaaS)
A10 review/comments, A11 roles/free reviewer seats, B3 subscription pricing (becomes one-time license), org/multi-tenant everything.

### PUNTED — with a free substitute
A6 PDF: ship a print stylesheet; browser Ctrl+P → Save-as-PDF covers utilitarian needs. The rubric's only negative-Net feature, deleted at zero cost.

**Net build list:** markdown editor w/ autocomplete · include/variable/condition resolver · where-used indexer · snapshot manager · static-site builder · license check · sample workspace. Each is a small, separately vibe-codeable module.

---

## PART 2 — WORKSPACE FORMAT (the "schema" is a folder)

```
my-docs/                          ← user picks/creates this folder
├── workspace.json                ← workspace settings
├── variables.json                ← the variable table
├── conditions.json               ← user-defined condition dimensions and their values
├── docs/                         ← the document tree (folders = sidebar hierarchy)
│   ├── index.md
│   ├── getting-started.md
│   └── guides/
│       ├── _folder.json          ← optional: folder title/order
│       └── installation.md
├── snippets/                     ← reusable blocks, org-wide by nature; may be
│   ├── warning-banner.md            organized into folders for tidiness —
│   ├── support-contact.md           {{> name}} always resolves by filename
│   └── legal/                       stem, workspace-wide-unique, regardless
│       └── _folder.json             of which folder it lives in
├── templates/                    ← reusable starting points for new docs/snippets
│   ├── docs/                        (Phase 8d); same file shape as docs/ and
│   │   └── release-notes.md         snippets/ above, placeholder content
│   └── snippets/                    instead of real content
│       └── callout.md
├── publications/                 ← ordered compositions of docs (Phase 9); each
│   └── user-guide.json              file is one publication — a tree of doc
│                                     references and structural headings
└── .app/                         ← app-managed; rebuildable except history/
    ├── index.json                ← where-used cache (disposable; rebuilt by scan)
    ├── history/                  ← snapshots: 2026-07-08T1430_publish/ ...
    └── publish-log.json          ← one entry per publish (digest source)
```

There is no `publish/` folder in the workspace — publishing never writes
generated HTML back into the workspace itself. Instead, Publish builds the
static site in memory and packages it as a `.zip` archive, which the user
saves wherever they choose via the browser's native save-file dialog (one
export per save, so nothing gets silently overwritten — repeat exports are
just repeat saves). Inside every exported zip:
- `index.html` at the archive root — a Home landing page (site title + a
  table-of-contents linking into every page), generated fresh on every
  export, never authored by the user.
- `content/` — the rest of the built site: one HTML page per document (or,
  for a Publication export, the single composed page), plus the shared
  nav/search/print-stylesheet chrome.

Per-Publication exports (Phase 9c) follow the same shape — a Home page at
the zip root linking to the one composed page under `content/`.

### File contents

**workspace.json**
```json
{
  "name": "Acme Product Docs",
  "site": { "title": "Acme Docs", "logo": "assets/logo.png" },
  "publishProfiles": {
    "public":   { "audience": ["customer"], "output": ["web"] },
    "internal": { "audience": ["customer", "internal"], "output": ["web"] }
  },
  "formatVersion": 1
}
```

**variables.json** — key → value, plus description for the picker
```json
{
  "product_name":  { "value": "AcmeCloud",        "description": "Official product name" },
  "support_email": { "value": "help@acme.com",    "description": "" },
  "version":       { "value": "3.2",              "description": "Current release" }
}
```

**conditions.json** — user-defined dimensions and values, editable in-app (Edit conditions panel)
```json
{
  "audience": ["customer", "internal"],
  "output":   ["web"]
}
```

**A document (docs/guides/installation.md)** — YAML frontmatter + markdown
```markdown
---
title: Installing {{product_name}}
description: Get up and running in ten minutes.
order: 2
---

# Installing {{product_name}}

{{> warning-banner}}

Download version {{version}} and run the installer.

:::when audience=internal
Internal note: staging licenses live in the shared vault.
:::

Questions? Email {{support_email}}.
```

**A snippet (snippets/warning-banner.md)** — same shape, plus lineage fields
```markdown
---
name: warning-banner
description: Standard caution box for destructive actions
forked_from: null          # or "old-warning-banner"
forked_from_snapshot: null # history timestamp it was copied at
---

> ⚠️ **Careful:** this action cannot be undone.
```

**Templates (templates/docs/*.md, templates/snippets/*.md, Phase 8d)** — a
template uses the exact same frontmatter/body shape as a real document or
snippet (above), with placeholder content in place of real content. "New
from template" copies the chosen template's body verbatim into a new file
under docs/ or snippets/, overwriting only the identity frontmatter field
(`title` for docs; `name` — plus resetting `forked_from`/
`forked_from_snapshot` to null — for snippets) to match the new entry's
title; the template file itself is never written to by this flow.
Archiving a template moves it to a `templates/docs/archived/` or
`templates/snippets/archived/` subfolder rather than deleting it — hidden
from the "New from template" picker, still listed (and editable) in the
Templates panel. Templates are excluded from the resolver, indexer,
where-used index, and publish pipeline — `{{key}}`/`{{> name}}` tokens
inside a template's placeholder body are inert until the instantiated copy
is published. `templates/` is covered by `.app/history/` snapshots (Save
now / Restore) but not by `publish-log.json`'s changelog digest, since
templates never publish.

**A publication (publications/user-guide.json)** — ordered tree of doc
references and structural-only headings; nodes are not copies of doc
content, just pointers, so editing a doc updates every publication that
includes it (Phase 9)
```json
{
  "title": "User Guide",
  "nodes": [
    { "type": "heading", "title": "Getting Started" },
    { "type": "doc", "ref": "docs/getting-started.md" },
    { "type": "doc", "ref": "docs/guides/installation.md", "children": [
      { "type": "doc", "ref": "docs/guides/uninstall.md" }
    ] },
    { "type": "heading", "title": "Reference", "children": [
      { "type": "doc", "ref": "docs/faq.md" }
    ] }
  ]
}
```
Heading levels are NOT stored here — the builder assigns them at publish
time from each node's depth in the tree (Phase 9c), after condition-tag
filtering removes any excluded branches. A `doc` node's single H1 (see the
heading-normalization rule below) becomes that node's title at whatever
level its position implies; the doc's own internal H2-H6 body headings
shift down to stay correctly nested beneath it. A `doc` node may itself
carry `children` (sub-docs and/or sub-headings nested beneath it) — a
heading isn't required as scaffolding just to nest something under a doc;
`heading` remains the only node kind that's structural-only (no content of
its own).

**Heading normalization (applies to every document):** a document has
exactly one H1 — its title, the same string as its frontmatter `title`
field — used as the doc's label when placed in a publication tree. H2-H6
remain free-form for the document's own internal structure; this rule
constrains *title* uniqueness per doc, not the total number of headings
a doc may contain.

**Syntax rules (one mental model: curly braces = dynamic):**
- `{{key}}` → variable substitution at publish
- `{{> name}}` → snippet transclusion (live: always current content; snippets may contain variables; one level of snippet-in-snippet allowed, deeper is refused with a friendly error — Deming cap). Resolves by filename stem only — the snippet's folder location never affects this, so snippet names must stay unique across the whole workspace, not just within a folder
- `:::when dimension=value ... :::` → block included only when the active publish profile contains that value; dimensions and values are user-defined in conditions.json (Edit conditions panel) — any tag not defined there is a build warning, block excluded
- Frontmatter `when: audience=internal` → conditions applied to a whole page

**Ordering in the sidebar:** folders are titled/ordered via `_folder.json`
(`{title, order}`); individual documents and snippets order themselves
*within* their folder via the frontmatter `order` field shown above — both
are self-describing metadata living inside the entry itself, so there's no
separate index file to keep in sync. Both are also draggable in the sidebar
to reorder, or to move a document/snippet into a different folder.

**.app/index.json** (rebuildable cache — where-used in file form)
```json
{
  "builtAt": "2026-07-08T14:30:00Z",
  "snippets":  { "warning-banner": ["docs/guides/installation.md", "docs/faq.md"] },
  "variables": { "product_name":  ["docs/index.md", "docs/guides/installation.md"] },
  "conditions":{ "audience=internal": ["docs/guides/installation.md"] }
}
```

**.app/publish-log.json** — one entry per publish (changelog + audit)
```json
[
  {
    "at": "2026-07-08T14:30:00Z",
    "profile": "public",
    "snapshot": "2026-07-08T1430_publish",
    "changes": { "added": ["docs/faq.md"], "updated": ["docs/index.md"], "removed": [] }
  }
]
```

---

## PART 3 — MIGRATION MAP (folder → Schema 1 / Supabase)

| Local artifact | Schema 1 destination | Notes |
|---|---|---|
| workspace | organization + project | One workspace → one org with one project |
| docs/ tree | document rows | Folder nesting → parent_document_id; `order` → sort_order; frontmatter → columns |
| snippets/*.md | snippet rows | `forked_from` → forked_from_snippet_id (resolved by name); folder nesting → parent_snippet_id (organizational only — does not affect the snippet's name/identity) |
| variables.json | variable rows | project_id null (org-wide) |
| conditions.json | condition_tag rows | dimension column maps directly |
| .app/index.json | document_snippet / document_variable / document_condition | Or simply rebuilt server-side on import |
| .app/history/ | document_version / snippet_version | Timestamp → created_at; optional import |
| publish-log.json | publish_log + publish_log_entry | Preserves the user's changelog continuity |
| publications/*.json | publications + publication_nodes | Ordered tree → parent_node_id + sort_order; doc nodes reference document rows by id, resolved from their `ref` path at import time |
| license key | subscription | Grandfather one-time buyers with SaaS discount |
| templates/ (Phase 8d) | *not yet mapped* | Flagged for Phase 11 design — likely template rows shaped like document/snippet rows, scoped org-wide like snippets |

**Design guarantee:** every concept in the folder has exactly one home in Schema 1, so the SaaS importer is a directory walk + inserts — an afternoon of code, not a project. The reverse is also true: the SaaS's "export everything" writes this exact folder, which keeps the covenant symmetrical.

## PART 4 — DATA-SAFETY STORY (the wipe question, answered in writing)
1. Truth lives in the user's folder — ordinary files, readable in Notepad.
2. Browser storage holds only the folder-permission handle + UI prefs; wiping it costs one re-pick of the folder.
3. `.app/history/` snapshots protect against fat-fingered edits.
4. Onboarding recommends placing the workspace inside a folder already synced by the Dropbox/Google Drive/OneDrive desktop app (or a git repo) — inheriting professional-grade backup for free, with no integration needed on our end.
5. Marketing line this earns: "Your docs are markdown files in your folder. Cancel nothing, export nothing — you already have everything."
