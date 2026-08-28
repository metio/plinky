<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
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
the shared lint gate, coverage, the story screenshots, a11y and Lighthouse run —
they are easy to forget precisely because this repo's own workflow never names
them. The
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

**Run every cheap gate locally before pushing, and check the exit code of each
one.** Not a subset of those, not "the ones the change looks related to" — a
cheap gate you skip is a gate CI runs for you, slower and after the push. The
whole point of the flake is that local and CI resolve identical tools.

**Five gates are heavy, and on this host they run under `capped` — always.**
They instrument the whole tree or drive a browser over every page, and run loose
they do not merely take a long time: they push the desktop's pages into swap.
That froze the browser twice and killed a tmux session, with the load average
past 40 on sixteen cores.

```sh
nix develop --command capped npm run coverage
nix develop --command capped npm run test:storybook -- -u
nix develop --command capped ci-lighthouse
nix develop --command capped npm run a11y:light
CAPPED_MEM=14G nix develop --command capped npm run test:browser
```

| Gate | What it does |
| --- | --- |
| `npm run coverage` | Instruments the whole tree and reruns every project. |
| `npm run test:storybook` | ~290 screenshots across two themes, one browser round-trip each. Run it as a check only when you mean to; `-- -u` refreshes baselines after a deliberate visual change. |
| `ci-lighthouse` | Builds the site, then drives 22 pages through headless Chrome. |
| `npm run a11y:light` / `a11y:dark` | Builds the site, then axe over the same 22 pages, twice. |
| `npm run test:browser` | Three vitest projects — chromium, firefox, mobile — each with its own browser. Needs `CAPPED_MEM=14G`; see below. |

`capped` is a devShell wrapper (`flake.nix`) that puts the command in a systemd
scope with `CPUQuota=600%`, `MemoryMax=8G`, `MemorySwapMax=0` and `IOWeight=50`.
`MemorySwapMax=0` is the one that saves the machine: denied swap, a run that
overreaches is OOM-killed inside its own scope while everything outside keeps its
pages — the run dies instead of the desktop. On CI, and anywhere without a
systemd user session, it execs straight through, so the same command line works in
both places.

`CAPPED_CPU` and `CAPPED_MEM` override the defaults, and both take a systemd value
rather than a bare number — `CAPPED_CPU=1000%`, where `1000` is refused outright
with `Failed to parse CPUQuota= value`. **`npm run test:browser` does not fit in the
default 8G**: its three browser projects run in parallel, and the kernel OOM-kills
the scope partway through. That failure is quiet in a way the others are not —
exit 143 and a log that stops after `RUN v4.x`, with no summary line and no failing
test named — so a run whose log has no `Test Files` line has not passed, whatever
the exit code of a pipeline around it says. `CAPPED_MEM=14G` completes it, and on
this 30G host still leaves the desktop its pages.

Two things `capped` does not fix. It bounds one command, not two: running two
`nix develop --command npm …` invocations at once still races on the gitignored
`app/paraglide/` (see below), and two capped runs still add up. And CI remains
where these gates are *expected* to run — pushing and reading the run is still
cheaper than a local sweep when you have no particular reason to reproduce one.

The other host limit is the ordinary one: this is a Fedora Atomic (ostree)
machine with rootless Podman and nix-portable, so a gate needing `kind`, a
privileged container, a system-level nix daemon, or real MIDI/audio hardware
could not run here at all. Plinky has no such gate today.

**Only English used to be verified, and the deploy ships 26 languages.** English is the
one language none of these gates needed to check: it is the shortest, and every string in
the app was written to fit it. Both worst cases are now derived by
`dev/locale-stress.mjs` rather than named, so they follow the translations:

- `--widest` — the longest word a line cannot be broken inside (Danish today). `ci-widths`
  builds it and measures the site at 320/360/390px.
- `--heaviest` — the most message text by bytes (Greek today, 2.07× English).
  `build:single` builds it, so the size budget, both a11y sweeps and `ci-lighthouse` all
  measure the worst case: if the heaviest language fits, all twenty-six do. Weighed
  honestly the first time, that was 21.8 KB the size budget had never seen.

Expect both budgets to move when the translations do — the size gate prints which locale
it weighed so a jump can be read. The a11y sweep now fails when an audited page was never
built rather than reporting a clean sweep over the SPA shell, which is what a mismatched
locale produced. Still measured in `en` alone: the story screenshots, which render
components rather than pages.

`ci-build` dies with `EMFILE: too many open files, watch` when this host's inotify
instances (`fs.inotify.max_user_instances`, 128) are exhausted — an editor plus a few
builds is enough. `CHOKIDAR_USEPOLLING=true nix develop --command ci-build` polls
instead of watching and completes.

Never run two `nix develop --command npm …` invocations concurrently: each
regenerates the gitignored `app/paraglide/`, and a mid-read resolve error fails
a dozen files spuriously. One at a time.

Check exit codes directly — `$?` after a pipe reports the *last* command's
status, so `npm run x | tail` reports `tail`'s success and hides the failure.
Use `nix develop --command <cmd> > /tmp/x.log 2>&1; echo "EXIT: $?"`.

The repo's own gates:

```sh
npm run typecheck   # app + core, AND dev/*.mts via tsconfig.devcheck.json
npm test              # node project (vitest)
npm run test:browser  # real chromium + firefox (vitest browser mode) — capped, see above
npm run test:storybook # CI ONLY as a check; locally only `-- -u` to refresh baselines
npm run coverage      # CI ONLY — ratchet thresholds; a drop fails the build (skips
                      # the storybook project: screenshots measure no lines and starve
                      # under instrumentation, so CI runs them as their own gate)
npm run arch          # layer rules + confined globals
npm run tailwind      # every class name compiles against app.css (blocking)
npm run tokens        # colour is named by role, not hue (blocking)
npm run messages:check # every locale carries every message (blocking)
npm run news:check    # NEWS.md still matches changelog.yaml (blocking)
npm run songs:bake -- --check  # grades, curation, composer index and slices are baked
                      # (blocking) — it also remeasures a spread of songs and every
                      # exercise, so a manifest costed under an older difficulty model
                      # fails here rather than shipping
npm run songs:calibrate  # what the difficulty model scores teaching repertoire at, and
                      # the grade boundaries that implies (a report, not a gate)
npm run songs:anchors # the gate half of it (blocking): every collection in
                      # dev/grade-anchors.json still resolves to the catalogue. Reads the
                      # manifest only, so it is instant — a pattern that stops matching
                      # weakens the calibration without saying so
npm run people:dupes  # the report: composer pages that might be one person
npm run people:dupes -- --check  # the gate (blocking) — every candidate pair needs a
                      # ruling in dev/catalog-people-distinct.json, or an alias in
                      # core/person.ts if they really are one person
npm run ci:parity     # every CI gate job maps to a ci-* nix wrapper (blocking)
npm run knip          # dead code (blocking)
npm run lint          # biome lint + format; a WARNING fails it too
                      # (--error-on-warnings), so dead code cannot accumulate
npm run nav           # navigation-depth budget
nix develop --command ci-widths  # CI ONLY — every page fits 320/360/390px, in the
                      # language that stresses a narrow layout hardest (it builds that
                      # locale first; dev/widest-locale.mjs derives which)
npm run brand         # regenerates brand/ from app.css + the icon (not a gate)
npm run icons         # regenerates public/ icons + favicon from icon.svg (not a gate)
npm run bytes         # no control bytes in tracked source (blocking) — a NUL
                      # makes git call a file binary, and a binary file reviews
                      # as an empty diff
nix develop --command ci-build   # the single-locale (en) build CI + the deploy measure
npm run size          # bundle budget — measures the ci-build output
npm run a11y:light    # CI ONLY — axe over the built site (builds it first)
npm run a11y:dark     # CI ONLY
nix develop --command ci-lighthouse  # CI ONLY — perf/SEO/CLS budgets (builds the site)
```

**Every per-visitor budget measures the same build, and each gate now produces it.**
`npm run build:single` (`PLINKY_LOCALE=en npm run build`) is the one definition of that
build — one tree-shaken locale, exactly what the deploy ships. `ci-build`, both a11y
sweeps and `ci-lighthouse` all route through it, so there is nothing to sequence and
nothing to remember.

A plain `npm run build` prerenders all 26 locales into the same directory (a local
preview convenience that ships nowhere). Measuring *that* reports ~3× the per-visitor
weight, which reads exactly like a real regression: it fails the size budget, and it
used to fail Lighthouse's script-payload assertion on every page at once. So all three
consumers of `build/client` refuse an all-locales tree and name the command that fixes
it — `dev/single-locale-build.mjs` is that check, shared by the size gate, the a11y
sweep and `ci-lighthouse`. The trap that remains is only the one you have to ask for:
run `npm run build` by hand, then a gate, and it stops you.

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

## The design system on claude.ai/design

Plinky's components are published as a design system, so a design agent builds with the
real parts instead of generic ones. `/design-sync` in Claude Code runs it: it compiles
every storied component into a bundle, screenshots each preview against this repo's own
Storybook render, and uploads only what matched. `.design-sync/` holds the settings
(`config.json`), the repo-specific gotchas (`NOTES.md`), the conventions header the agent
reads (`conventions.md`), and the four hand-owned previews; everything else there is
generated and gitignored.

Two things to know before running it. It compiles `app/paraglide/` for **English and
German alone** — all 26 locales are three quarters of the bundle and push it past the
upload's size cap — so **run `npm run messages` afterwards** or the tree stays
two-language. And it builds a reference Storybook into `.design-sync/sb-reference/`, which
no repo gate builds, so a `.storybook/` change can break it while every gate stays green.

## Conventions the tools don't fully enforce

- **A new page is a route in `app/routes.ts`, and nothing else.** The prerender paths,
  the audited URL set (Lighthouse and the axe sweep share one list) and the
  SEO-assertion opt-out all derive from that table through `dev/pages.mjs` — so a page
  gets its static document, gets audited in both themes, and is bucketed correctly the
  moment it exists. These used to be separate hand-kept lists, and being absent from one
  was invisible: a route with no prerender entry 404s as a static document, and an
  unlisted page is simply never audited while both gates still pass. What is *not*
  derived, because it cannot be read off the source: which pages arrive carrying the
  notation machinery (measure it — a wrong guess fails loudly in `lighthouserc.js`), and
  the bundle-size ratchet, which exists to make a human decide.
- **Colour is a token, never a hue.** `app/app.css` names every colour for its
  role — `muted`, `line`, `accent-solid`, `danger-surface`, plus the domain ones
  (`paper`, `ghost`, `hand-left`, `band-*`) — and each resolves to a light value
  in `@theme` and a dark one in the `.dark` block below it. Components write
  `text-muted`, never `text-gray-500 dark:text-gray-400`; `npm run tokens` is a
  blocking gate that rejects any raw palette utility under `app/` and any token
  missing one of its two themes. Adding a token is the whole cost of a new role:
  the gate reads the names out of `app.css`, so there is no second list. Pure
  `white` and `black` stay legal — white text on a solid fill means the same
  thing in both themes. What the gate can't decide for you is whether a colour is
  *chrome* or *data*: the share grid's `band-*` scale is matched to the 🟩🟨🟧🟥⬜
  emoji and to the literal hexes `core/shareCard.ts` bakes into the exported
  image, so it must never be folded into `success`/`warn`/`danger` — moving a
  state colour for contrast would quietly turn five bands into four.
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
  800×600 viewport, the flake pinning the browser so local and CI rasterize
  the same way — closely, but not to the pixel). After an intentional visual
  change — or when adding a story —
  refresh with `npm run test:storybook -- -u` and commit the changed images; a
  baseline diff in review is the feature. **A green local run does not prove CI
  agrees.** The comparator allows `allowedMismatchedPixelRatio: 0.005`
  (`vitest.config.ts`), so a change landing near that line can measure under it
  on one machine and over it on another — a card border moving one palette step
  did exactly that, passing every local run while CI rejected it. Treat a
  baseline failure CI reports but this host cannot reproduce as real. Note that
  `-u` only rewrites what it considers mismatched, so where local sees no
  mismatch it is a no-op and re-running it changes nothing: **delete the
  offending PNG first**, then `-u` rebuilds it from the current render. A
  deliberate visual change whose diff lands near the threshold is worth pushing
  clearly over or under it, since a borderline baseline can flip between
  machines on an unrelated commit. Stories must render
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
- **A grade is a fixed mark, not a place in the queue.** `GRADE_THRESHOLDS.piece` in
  `core/scoreDifficulty.ts` holds absolute cost boundaries, calibrated against teaching
  collections whose level is settled (`dev/grade-anchors.json`); `npm run songs:calibrate`
  measures them and prints the boundaries they imply. Each anchor carries a `least`, and
  `npm run songs:anchors` fails when one falls below it — the boundaries were cut from
  those collections, and a pattern that quietly stops matching leaves the file claiming
  nineteen of them while the next calibration runs on eighteen. They were octiles of the harvest
  once, which meant every import silently re-graded pieces a player had already worked on.
  Nothing derives them at bake time any more — moving them is a decision, and it re-grades
  the catalogue.

  What *is* derived every bake is **cost**, because cost is whatever the difficulty model
  currently says. Change `core/scoreDifficulty.ts` or `core/fingering.ts` and every stored
  cost is stale. `songs:bake` remeasures all exercises outright (both kinds are
  reproducible from what the repo ships — a tile from its stored config, a study from its
  `.mxl` — so no PDMX corpus is needed) and probes a spread of songs, failing with the
  command to run rather than baking grades from numbers the model no longer produces. The
  songs themselves are remeasured by `npm run songs:cost`, which takes about half an hour
  and is why it is a probe rather than a full pass. `npm run exercises` needs the PDMX
  corpus for its Hanon sourcing and so cannot be the thing that keeps costs current.

  Scale and arpeggio tiles are graded on their own scales, since fingering a scale costs
  more than fingering a stepwise tune. Those boundaries have no outside repertoire to
  anchor them and need none — the tiles are a fixed curriculum, so their boundaries are
  its octiles — but they do not follow the model on their own, so `songs:bake` fails when
  a category's tiles collapse into one grade.

- **A named work is a built-in assignment, not a new kind of thing.** Plinky already has
  assignments — a named, ordered list of pieces — so a book of studies is one, and there is
  no second concept for a player to learn. `dev/builtin-assignments.json` names the works
  (composer and title patterns, plus the `least` number of pieces below which the set has
  stopped being that work); `songs:bake` resolves them against the manifest into
  `public/songs/builtin-assignments.json` and fails when one drops below its minimum, so a
  pattern that has rotted is caught rather than rendering as an empty card. Matching
  happens at bake time on purpose: no pattern table reaches a visitor's bundle. Only
  `solo-piano` pieces are eligible — a set is something to work through at the keyboard.

- **A hand-made correction to catalogue metadata goes in `dev/catalog-curation.json`**,
  never straight into `public/songs/manifest.json`. The manifest is written by
  `songs:import` from the harvested corpora, so an edit there survives until the next
  import and no longer; the curation file is keyed by song id (a fingerprint of the notes,
  so it outlives re-slugging and re-licensing) and re-applied by `npm run songs:bake`,
  which is the CI gate. Only `title` and `composer` may be corrected — a licence is a
  legal fact about the score, and grade and cost are derived from the notes. Each entry
  carries a `why`. A composer's *spelling* is a different question: `ALIASES` in
  `core/person.ts` maps a spelling to one person for display, across every piece bearing
  it, now and in future.
- **Every file** carries the two SPDX header lines declaring the Plinky Authors
  and the AGPL-3.0-or-later licence (or a `REUSE.toml` entry when the format can't
  hold comments), like the top of this file. The catalogue is the exception: scores
  and manifests keep their own Creative Commons terms in `REUSE.toml`, and a
  relicensing sweep must never touch them.
- **Every commit is signed off** — `git commit --signoff` — under the Developer
  Certificate of Origin. The `dco` job in `verify.yml` fails a pull request whose
  commits lack the trailer.
- **Update README.md in the same change** whenever a user-facing feature is
  added or changed.
- **Update [BACKEND.md](BACKEND.md) in the same change** whenever backend work
  contradicts it — an endpoint, a schema, a limit, a merge policy, an invariant,
  or a phase reaching its exit criterion. The document is the design *and* the
  implementation plan for backend mode, so a session that reads a stale one
  re-derives a decision that was already made and argued. It is append-only where
  it records decisions: a reversal gets a new row saying so, leaving the original
  in place, because a reader who cannot see that a path was abandoned will propose
  it again. Nothing in it is user-facing — player-visible changes still go to
  `changelog.yaml` and `README.md` in the [VOICE.md](VOICE.md) register.
- **Add an entry to `changelog.yaml` in the same change**, for anything a player
  would notice — a new feature, a changed behaviour, a bug they'd have hit.
  Plinky has no versions, tags or releases (every push to main deploys), so
  nothing else records what changed and nothing generates it from the log:
  unwritten at the time means unwritten for good. Write for a player, not a
  contributor — what is different on screen and why it matters — in the
  [VOICE.md](VOICE.md) register. Purely internal work gets no entry; when a day
  is mostly internal, say the small user-visible part and stop rather than
  padding it.

  Releases are newest first, one per shipping day, with a `label` (`night`,
  `evening`) where a day shipped more than once. An entry is usually just its
  Markdown, written as a literal block; `twip: false` holds one back from the
  weekly round-up posted to the subreddit, and everything else goes in it — an
  entry only exists here if a player would notice, so opting *in* would mean a
  forgotten field silently posts nothing.

  **`NEWS.md` is generated from it and must not be hand-edited.** The README
  sends players to that file, so it stays Markdown; `npm run news` renders it
  and `npm run news:check` is a blocking gate. `typecheck` regenerates it
  first, so editing the list and running any gate is enough — but the rendered
  file is tracked, so it appears in the diff and gets committed with the entry.
  Note that `ci-markdown` only lints **tracked** files, so `git add NEWS.md`
  before running it.

## Product guardrails

- **No streaks, ever.** Plinky never punishes a missed day; the daily challenge
  has a ✓ and cumulative stats, nothing consecutive.
- **No ranked competition, ever.** No leaderboards, no ladders, no rank against
  other players — decided 2026-08-09, and it is the same instinct the streak rule
  refuses. Ranking is pressure, and the friendliness Plinky promotes is worth more
  than the engagement a ladder would buy. Comparison is allowed only in the shape
  the daily share grid already uses: a histogram of where people landed, showing a
  player their own band and never a position above or below anyone. See
  [BACKEND.md](BACKEND.md) for the full reasoning, including why the server-side
  referee such a ladder would need could not have proven anything anyway.
- **The catalogue is Creative-Commons only**, and every piece credits its
  composer, source and licence in the app.
