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

The toolchain is a nix flake (`flake.nix`) built on the shared
[metio/nix-devshell](https://github.com/metio/nix-devshell) — node, chromium +
firefox (for the vitest browser + a11y gates), and the shared lint gate (reuse,
typos, yamllint, actionlint, markdownlint). Run any command through it so
local and CI resolve the identical versions pinned in `flake.lock`:

```sh
nix develop --command npm test      # one-off
nix develop                         # or enter the shell, then run commands bare
```

CI mirrors this exactly: every job in `.github/workflows/verify.yml` is
`nix develop --command …` behind the `metio/nix-devshell` action, and the
`Frontend` job delegates to `metio/ci`'s reusable `frontend.yml`, which is where
the shared lint gate, coverage, a11y and Lighthouse run — they are easy to
forget precisely because this repo's own workflow never names them. The
`playwright` npm version is held to the flake's `playwright-driver`, so bump
both together.

Each gate is also a **`ci-<name>` wrapper** defined with `writeShellScriptBin` in
`flake.nix`, capturing exactly how CI invokes it (e.g. `ci-build` bakes in the
per-locale `PLINKY_LOCALE=en` build the size budget measures, `ci-reuse` is
`reuse lint`). So `nix develop --command ci-<name>` runs precisely what CI runs,
and the same name works bare inside `nix develop` — the `ci-` prefix leaves the raw
tool free for its other modes. A CI gate job must invoke its check through a
`ci-*` wrapper, never a raw command inline; `npm run ci:parity` is a blocking gate
that enforces this and that every wrapper a job names exists in `flake.nix`. The
shared lint-gate wrappers (`ci-reuse`, `ci-typos`, `ci-yaml`, `ci-actionlint`,
`ci-markdown`) are not defined here — they come from
`devshell.lib.mkDevShell`, so every metio repo inherits one definition, and this
flake only defines the gates that are Plinky's own.

## The gate

**Run every gate locally before pushing, and check the exit code of each one.**
Not a subset, not "the ones the change looks related to" — a gate you skip is a
gate CI runs for you, slower and after the push. The whole point of the flake is
that local and CI resolve identical tools, so there is no gate here that is
"CI's job".

The only acceptable reason to skip one is that this host physically cannot run
it. This is a Fedora Atomic (ostree) machine with rootless Podman and
nix-portable, so a gate needing `kind`, a privileged container, a system-level
nix daemon, or real MIDI/audio hardware could qualify. **Plinky has no such gate
today** — everything below runs here, so the local list and CI are the same list.
If that ever changes, name the excluded gate and the host reason right here.

Check exit codes directly — `$?` after a pipe reports the *last* command's
status, so `npm run x | tail` reports `tail`'s success and hides the failure.
Use `nix develop --command <cmd> > /tmp/x.log 2>&1; echo "EXIT: $?"`.

The repo's own gates:

```sh
npm run typecheck
npm test              # node project (vitest)
npm run test:browser  # real chromium + firefox (vitest browser mode)
npm run test:storybook # every story, light and dark, against its baseline
npm run coverage      # ratchet thresholds — a drop fails the build
npm run arch          # layer rules + confined globals
npm run tailwind      # every class name compiles against app.css (blocking)
npm run messages:check # every locale carries every message (blocking)
npm run ci:parity     # every CI gate job maps to a ci-* nix wrapper (blocking)
npm run knip          # dead code (blocking)
npx biome check       # lint + format
npm run nav           # navigation-depth budget
nix develop --command ci-build   # the single-locale (en) build CI + the deploy measure
npm run size          # bundle budget — measures the ci-build output
npm run a11y:light    # axe over the built site (needs the ci-build above)
npm run a11y:dark
```

**Build for the size/a11y gates with `ci-build`, not `npm run build`.** `ci-build`
bakes in `PLINKY_LOCALE=en npm run build` — one tree-shaken locale, exactly what
the deploy ships and what the size budget tracks. A plain `npm run build` prerenders
all 26 locales into one tree (a local-preview convenience that ships nowhere); run
`npm run size` against *that* and it measures ~3× the per-visitor weight and fails
for the wrong reason. `size` now detects this and tells you to switch to `ci-build`,
and `npm run build` prints the same reminder — but reach for `ci-build` first and
neither fires.

The shared metio lint gate runs in CI through `metio/ci`'s reusable
`frontend.yml`, which is why it is easy to forget it exists — its wrappers come
from `devshell.lib.mkDevShell` and run here exactly as they run there. Prose
comments and locale strings are the bulk of most diffs, so `ci-typos` earns its
place:

```sh
nix develop --command ci-typos
nix develop --command ci-reuse
nix develop --command ci-yaml
nix develop --command ci-actionlint
nix develop --command ci-markdown
```

`typecheck` and `lint` first verify (via `dev/check-node-modules.mjs`) that the
installed `node_modules` still matches `package-lock.json` — after a rebase or
pull that bumps a dependency, run `npm ci` first, or the local gate runs older
tools than CI's fresh install and can pass what CI fails.

## Conventions the tools don't fully enforce

- **New persistent state** = a store factory in `app/stores/` over the injected
  `KeyValueStore` (use the `jsonStore` idiom), registered as an `AppServices`
  capability in `app/contexts/services.tsx` — in all three places: the type, the
  build, and `SERVICE_KEY_SET` (the compiler flags a miss in any of them). Add the
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
- **Tests select controls by message key, not copy.** Use the helpers in
  `app/testing/controls.ts` (`toggle`/`switchOn` for SwitchField,
  `choose`/`chosen` for ChoiceField, `pressed` for ToggleIconButton) and pass
  the paraglide message the component renders — `toggle(m.settings_play_sounds)`
  — so a reworded label can't strand a selector; the same goes for plain role
  queries (`getByRole("button", { name: m.assignments_save() })`). Hardcode a
  string only when the copy itself is what the test asserts. The helpers stay
  role-based on purpose — never reach for data-testid.
- **Stories are visual regression tests, in both themes.** The `storybook`
  vitest project screenshots every story light and dark (the hook flips the
  `.dark` root class for a second, `-dark`-named baseline) and compares both
  to committed baselines in `app/**/__story-shots__/` (chromium-only, fixed
  800×600 viewport, the flake pins the browser so local and CI rasterize
  identically). After an intentional visual change — or when adding a story —
  refresh with `npm run test:storybook -- -u` and commit the changed images; a
  baseline diff in review is the feature. Stories must render
  deterministically: no live dates, no randomness, no unawaited async — and a
  story whose visible content includes emoji joins the `EMOJI_STORIES` skip
  set in `.storybook/vitest.setup.ts` (emoji glyphs rasterize
  machine-dependently).
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
