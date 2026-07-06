<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Working on Plinky

Plinky is a client-only React Router SPA (no backend; all state in the browser).
The architecture — a pure `core/` under ports, adapters, stores and components —
is described in [ARCHITECTURE.md](ARCHITECTURE.md) and **enforced** by
`npm run arch` (dependency-cruiser + `dev/check-globals.mjs`).

## The dev environment

The toolchain is a nix flake (`flake.nix`) that consumes the shared
[metio/ci](https://github.com/metio/ci) devShell — node, chromium + firefox (for
the vitest browser + a11y gates), and the shared lint gate (reuse, typos, yamllint,
actionlint, markdownlint). Run any command through it so local and CI resolve
the identical versions pinned in `flake.lock`:

```sh
nix develop --command npm test      # one-off
nix develop                         # or enter the shell, then run commands bare
```

CI mirrors this exactly: every job in `.github/workflows/verify.yml` is
`nix develop --command …` behind the `metio/ci/nix-devshell` action. The
`playwright` npm version is held to the flake's `playwright-driver`, so bump
both together.

## The gate

Run the full local gate and check exit codes before pushing (each through
`nix develop --command`); CI runs the same jobs plus markdown lint, REUSE,
typos and coverage:

```sh
npm run typecheck
npm test              # node project (vitest)
npm run test:browser  # real chromium + firefox (vitest browser mode)
npm run arch          # layer rules + confined globals
npm run messages:check # every locale carries every message (blocking)
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
  is the real integration. That project runs on **chromium + firefox** and grants
  no MIDI permission, so browser tests that mount `MidiProvider` must inject
  `fakeMidi` — otherwise the real adapter reaches for Web MIDI (which Playwright
  can't grant on firefox at all). The real Web MIDI adapter is exercised only in
  the separate **browser-midi** project, which is chromium-only with the `midi`
  permission pre-granted (firefox gates it behind an un-automatable add-on, webkit
  has no Web MIDI) — keep new real-adapter assertions in that one file.
- **Tests are essential.** Every new seam, store, adapter and component is a
  test target: memoryStore fakes for stores, fast-check property suites
  (`*.property.test.ts`) for pure core logic, `*.browser.test.tsx` for
  real-browser behavior.
- **UI strings** go through paraglide: add the key to `messages/en.json` (the
  base-locale contract) **and translate it into all other `messages/*.json`** —
  `npm run messages:check` is a blocking gate that fails on any locale missing a
  key (or carrying an orphan one), so a string can't ship English-only and
  silently fall back. Then `npm run messages` regenerates the gitignored
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
