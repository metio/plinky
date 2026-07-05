<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Working on Plinky

Plinky is a client-only React Router SPA (no backend; all state in the browser).
The architecture — a pure `core/` under ports, adapters, stores and components —
is described in [ARCHITECTURE.md](ARCHITECTURE.md) and **enforced** by
`npm run arch` (dependency-cruiser + `dev/check-globals.mjs`).

## The gate

Run the full local gate and check exit codes before pushing; CI runs the same
jobs plus markdown lint, REUSE, typos and coverage:

```sh
npm run typecheck
npm test              # node project (vitest)
npm run test:browser  # real chromium (vitest browser mode)
npm run arch          # layer rules + confined globals
npm run knip          # dead code (blocking)
npx biome check       # lint + format
npm run nav           # navigation-depth budget
npm run build         # includes the prerender
npm run size          # bundle budget
```

## Conventions the tools don't fully enforce

- **New persistent state** = a store factory in `app/stores/` over the injected
  `KeyValueStore` (use the `jsonStore` idiom), registered as an `AppServices`
  capability in `app/contexts/services.tsx` — in all five places: the type, the
  build, the provider destructure, the memo deps, and the `||` chain. Add the
  narrow `useXStore()` hook only once a component consumes it, or knip fails
  the build.
- **Components never import adapters or singletons** — they receive capabilities
  through the services context. Concrete adapters are wired only at the
  composition roots (`services.tsx`, `root.tsx`, the play route's static
  `meta()`); the dependency-cruiser rule pins this.
- **Pure logic lives in `core/`** — no React, no browser globals, no I/O; time
  and codecs arrive as parameters. If a store method grows domain logic, extract
  it down.
- **Write verdicts**: `KeyValueStore.set` returns whether the write landed.
  Stores pass it through; the storage-health banner (adapter latch) is the
  aggregate signal, and actions with their own "saved" indicator must gate it on
  the verdict.
- **jsdom component tests** render through `renderWithServices`
  (`app/testing/renderWithServices.tsx`) — one isolated in-memory world per
  test. `app/testing/stores.ts` is only for the **browser** project, whose job
  is the real integration. Browser tests that mount `MidiProvider` must inject
  `fakeMidi` — the test context has the MIDI permission pre-granted, so the
  real adapter would silently open a genuine connection.
- **Tests are essential.** Every new seam, store, adapter and component is a
  test target: memoryStore fakes for stores, fast-check property suites
  (`*.property.test.ts`) for pure core logic, `*.browser.test.tsx` for
  real-browser behavior.
- **UI strings** go through paraglide: add keys to `messages/en.json` only
  (other locales fall back), then `npm run messages` regenerates the gitignored
  `app/paraglide/`.
- **Every file** carries the two SPDX header lines declaring the Plinky Authors
  and the 0BSD licence (or a `REUSE.toml` entry when the format can't hold
  comments), like the top of this file.
- **Update README.md in the same change** whenever a user-facing feature is
  added or changed.

## Product guardrails

- **No streaks, ever.** Plinky never punishes a missed day; the daily challenge
  has a ✓ and cumulative stats, nothing consecutive.
- **The catalogue is Creative-Commons only**, and every piece credits its
  composer, source and licence in the app.
