<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Plinky Studio

The Sanity Studio that edits Plinky's live content — the app only *reads* this
content over the public API. Editors work in the browser at
<https://plinky-fun.sanity.studio>; this directory only holds the schema and
deploys the Studio that hosts it.

## What it defines

- **News** — a picture (+ alt text), a link, an optional headline, and a "Show this
  item" toggle. The most recently updated shown item appears on the home page.
- **Site settings** — a single document with **News board enabled**, the master
  switch that hides the whole banner when off.
- **Board artist** — an artist pinned to the `/board` page: a name, a picture,
  internationalized alt text and blurb, a follow link, an order, and a "Show this
  artist" toggle.

## Deploying

Every push to `main` that touches `studio/` redeploys the Studio through the
`Deploy Studio` workflow (it can also be run by hand from the Actions tab). The
workflow needs:

- Repository variables `VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET` (shared
  with the app's builds).
- The `SANITY_DEPLOY_TOKEN` secret — a robot token created in
  [sanity.io/manage](https://www.sanity.io/manage) under API → Tokens with the
  **Deploy Studio** permission.

To deploy from a machine instead, set the `SANITY_STUDIO_*` variables in `.env`
(copy `.env.example`), then:

```sh
npm ci && npx sanity login && npm run deploy
```

## Make browser reads work (in sanity.io/manage)

- **Public dataset** — API → Datasets → set `production` to Public (Plinky reads
  without a token).
- **CORS origin** — API → CORS origins → add `https://plinky.fun` (and
  `http://localhost:5173` for local Plinky development).
