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
| A4 Conditional tags | `:::when audience=internal` fenced blocks; publish profiles choose what's included | The differentiator nothing cheap has. Tags-only cap enforced by the format itself |
| A8 Where-used | Index panel: "warning-banner appears in 7 docs"; click-through; pre-publish impact list | The star screen (+24); locally it's just scanning files — nearly free |
| A7 Versioning | Automatic timestamped snapshots to `.app/history/` on publish + manual save-points; restore = copy back | Simple snapshot model; users with git get real VCS for free on top |
| A5 Publish | Client-side build → `publish/` folder of static HTML with sidebar nav + client search | The output that makes it a product, not a notes app |
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
├── conditions.json               ← allowed condition tags (the capped list)
├── docs/                         ← the document tree (folders = sidebar hierarchy)
│   ├── index.md
│   ├── getting-started.md
│   └── guides/
│       ├── _folder.json          ← optional: folder title/order
│       └── installation.md
├── snippets/                     ← reusable blocks (flat, org-wide by nature)
│   ├── warning-banner.md
│   └── support-contact.md
├── publish/                      ← generated site (safe to delete; rebuilt anytime)
└── .app/                         ← app-managed; rebuildable except history/
    ├── index.json                ← where-used cache (disposable; rebuilt by scan)
    ├── history/                  ← snapshots: 2026-07-08T1430_publish/ ...
    └── publish-log.json          ← one entry per publish (digest source)
```

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

**conditions.json** — the hard cap made physical: two dimensions, editable values
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

**Syntax rules (one mental model: curly braces = dynamic):**
- `{{key}}` → variable substitution at publish
- `{{> name}}` → snippet transclusion (live: always current content; snippets may contain variables; one level of snippet-in-snippet allowed, deeper is refused with a friendly error — Deming cap)
- `:::when dimension=value ... :::` → block included only when the active publish profile contains that value; unknown tags = build warning
- Frontmatter `when: audience=internal` → conditions applied to a whole page

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
| snippets/*.md | snippet rows | `forked_from` → forked_from_snippet_id (resolved by name) |
| variables.json | variable rows | project_id null (org-wide) |
| conditions.json | condition_tag rows | dimension column maps directly |
| .app/index.json | document_snippet / document_variable / document_condition | Or simply rebuilt server-side on import |
| .app/history/ | document_version / snippet_version | Timestamp → created_at; optional import |
| publish-log.json | publication + publication_document | Preserves the user's changelog continuity |
| license key | subscription | Grandfather one-time buyers with SaaS discount |

**Design guarantee:** every concept in the folder has exactly one home in Schema 1, so the SaaS importer is a directory walk + inserts — an afternoon of code, not a project. The reverse is also true: the SaaS's "export everything" writes this exact folder, which keeps the covenant symmetrical.

## PART 4 — DATA-SAFETY STORY (the wipe question, answered in writing)
1. Truth lives in the user's folder — ordinary files, readable in Notepad.
2. Browser storage holds only the folder-permission handle + UI prefs; wiping it costs one re-pick of the folder.
3. `.app/history/` snapshots protect against fat-fingered edits.
4. Onboarding recommends placing the workspace inside an already-synced folder (Dropbox/Drive/OneDrive) or a git repo — inheriting professional-grade backup for free.
5. Marketing line this earns: "Your docs are markdown files in your folder. Cancel nothing, export nothing — you already have everything."
