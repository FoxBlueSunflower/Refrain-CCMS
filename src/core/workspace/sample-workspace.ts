import {
  CONDITIONS_FILE,
  CURRENT_FORMAT_VERSION,
  FOLDER_META_FILE,
  PUBLICATIONS_DIR,
  TEMPLATES_DIR,
  VARIABLES_FILE,
  WORKSPACE_FILE,
} from './constants'

export interface SampleFile {
  path: string
  contents: string
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const workspaceJson = json({
  name: 'Acme Product Docs',
  site: { title: 'Acme Docs' },
  publishProfiles: {
    public: { audience: ['customer'], output: ['web'] },
    internal: { audience: ['customer', 'internal'], output: ['web'] },
  },
  formatVersion: CURRENT_FORMAT_VERSION,
})

const variablesJson = json({
  product_name: { value: 'AcmeCloud', description: 'Official product name' },
  support_email: { value: 'help@acme.com', description: '' },
  version: { value: '3.2', description: 'Current release' },
})

const conditionsJson = json({
  audience: ['customer', 'internal'],
  output: ['web'],
})

const guidesFolderJson = json({
  title: 'Guides',
  order: 3,
})

const userGuidePublicationJson = json({
  title: 'User Guide',
  nodes: [
    { type: 'doc', ref: 'docs/index.md' },
    {
      type: 'heading',
      title: 'Getting Started',
      children: [
        { type: 'doc', ref: 'docs/getting-started.md' },
        { type: 'doc', ref: 'docs/guides/installation.md' },
      ],
    },
  ],
})

const indexMd = `---
title: Acme Product Docs
description: Everything you need to run AcmeCloud.
---

# Acme Product Docs

Welcome to the {{product_name}} documentation.

{{> support-contact}}

See [Getting Started](getting-started.md) to begin, or dive into the [installation guide](guides/installation.md).
`

const gettingStartedMd = `---
title: Getting Started with {{product_name}}
description: A five-minute tour of the basics.
order: 1
---

# Getting Started with {{product_name}}

{{product_name}} version {{version}} is ready when you are.

1. Install {{product_name}} — see the [installation guide](guides/installation.md).
2. Explore the guides in the sidebar.
3. {{> support-contact}}
`

const installationMd = `---
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
`

const warningBannerMd = `---
name: warning-banner
description: Standard caution box for destructive actions
forked_from: null          # or "old-warning-banner"
forked_from_snapshot: null # history timestamp it was copied at
---

> ⚠️ **Careful:** this action cannot be undone.
`

const supportContactMd = `---
name: support-contact
description: One-line contact line reused across docs
forked_from: null
forked_from_snapshot: null
---

Questions? Email {{support_email}}.
`

const releaseNotesTemplateMd = `---
title: Untitled release
description: What changed in this release.
---

# Untitled release

## Highlights

-

## Fixes

-
`

const calloutTemplateMd = `---
name: untitled
description: Reusable callout box
forked_from: null
forked_from_snapshot: null
---

> Replace this with your callout text.
`

/**
 * The SPEC.md "Acme Product Docs" sample workspace, as an in-memory file
 * manifest. Pure — callers are responsible for writing these to disk.
 */
export function buildSampleWorkspaceFiles(): SampleFile[] {
  return [
    { path: WORKSPACE_FILE, contents: workspaceJson },
    { path: VARIABLES_FILE, contents: variablesJson },
    { path: CONDITIONS_FILE, contents: conditionsJson },
    { path: 'docs/index.md', contents: indexMd },
    { path: 'docs/getting-started.md', contents: gettingStartedMd },
    { path: `docs/guides/${FOLDER_META_FILE}`, contents: guidesFolderJson },
    { path: 'docs/guides/installation.md', contents: installationMd },
    { path: 'snippets/warning-banner.md', contents: warningBannerMd },
    { path: 'snippets/support-contact.md', contents: supportContactMd },
    { path: `${TEMPLATES_DIR}/docs/release-notes.md`, contents: releaseNotesTemplateMd },
    { path: `${TEMPLATES_DIR}/snippets/callout.md`, contents: calloutTemplateMd },
    { path: `${PUBLICATIONS_DIR}/user-guide.json`, contents: userGuidePublicationJson },
  ]
}
