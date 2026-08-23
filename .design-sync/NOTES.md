<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Syncing Plinky to claude.ai/design

What a run of `/design-sync` needs to know about this repo. The durable settings live in
`config.json` beside this file; these are the things a config field cannot hold.

## Repo shape

- **There is no `dist/`.** Plinky is a private application, not a published component
  library, so the converter is pointed at `.design-sync/entry.ts` — a barrel of every
  storied component. `node .design-sync/make-entry.mjs` derives it from the reference
  storybook's `index.json`, so a component that gains a story joins the bundle on the next
  run and a renamed one cannot linger.
- **Every command goes through the flake**: `nix develop --command …`, with
  `NP_RUNTIME=bwrap` exported. `node` and `npm` do not exist on the host.
- **Never run two `nix develop --command npm …` invocations at once** — each regenerates
  the gitignored `app/paraglide/`, and a mid-read resolve error fails a dozen files
  spuriously. The converter's own `node .ds-sync/…` runs are safe to parallelise; npm
  scripts are not.
- **Playwright comes from the flake**, pinned to `playwright-driver` and reachable only
  inside `nix develop` (`PLAYWRIGHT_BROWSERS_PATH` points into the nix store, which does
  not exist outside the namespace). So `.ds-sync/` installs `esbuild ts-morph
  @types/react` only — `playwright` resolves upward to the repo's own copy, which already
  matches the browsers. Never `npx playwright install`.

## Learnings

- `[GENERAL]` Every component rendered twice and every router/context hook threw
  ("Cannot destructure property 'basename'", "MIDI hooks must be used within a
  MidiProvider") → the converter redirects a story's component import to the bundle by
  matching the **file name** against an exported name, and our files are camelCase
  (`pianoKeyboard.tsx`) while the exports are PascalCase (`PianoKeyboard`), so the match
  never fired and each component was bundled a second time with its own React contexts →
  `cfg.storyImports.shim` on `/app/components/`, `/app/routes/`, `/app/contexts/`. Every
  name a story imports from those directories must then exist on the global, which is
  what `COMPANIONS` in `make-entry.mjs` covers.
- `[GENERAL]` `_ds_bundle.js` was 14 MB, over the 12 MB the upload accepts, and 11.8 MB
  of it was Paraglide — all 26 locales. `PLINKY_LOCALE` only marks the other languages
  dead and the converter bundles unminified, so nothing removed them → compile the
  messages for one locale instead (`.design-sync/messages-en.mjs`). 3.5 MB.
- `[GENERAL]` Every preview threw `import.meta.glob is not a function` at module init →
  `app/lib/catalog.ts` called Vite's glob at module scope, so the whole catalogue module
  took down anything importing it under a non-Vite bundler → the read is deferred and
  guarded, and an empty catalogue is the fallback.
- **`.storybook/preview.tsx` must import every face `app/app.css` names**, not just
  Inter: a `--font-display` heading with no display face loaded falls back to a system
  one, and the story screenshots — and the design system built from them — then show a
  face the app never ships. The display stack is Fredoka with Comfortaa behind it for
  Greek and Cyrillic, so both imports have to be there.

- `[GENERAL]` Reference storybook build failed with "The React Router Vite plugin
  requires the use of a Vite config file" → `.storybook/main.ts` filtered
  `viteConfig.plugins` by name, but a Vite plugin entry may be a nested array or a
  promise, so the React Router plugins were never visible to the filter → flatten and
  settle the list before filtering. The vitest storybook project tolerated the survivor;
  a real `storybook build` does not.

## Grading this repo

- **A `play`-driven story reaches its state through an interaction the generated wrapper
  never runs**, so its preview shows the pre-interaction state while storybook shows the
  result. The fix is an owned `.design-sync/previews/<Name>.tsx` that mirrors the story
  and performs the interaction on mount — `ConfirmButton.tsx` does it with a
  `display: contents` wrapper and a ref, so the extra element adds no layout box. The
  repo's only `play` story is `confirmButton`. `takesPanel` and `exportMenu` both look
  like candidates and are not: they render their open state from a plain arg.
- **The two panels sit on different grounds.** Storybook's canvas paints the app's paper
  cream and crops tight to the component's own bounds; the preview is a full-page shot on
  white. A transparent component (`bg-transparent` field classes, `MidiBadge`'s unfilled
  frame) therefore shows a different fill behind it, and a border sitting exactly on the
  component's edge (`SiteFooter`'s `border-t`) can be cropped out of the storybook side.
  Both are framing. Never "fix" either with an owned preview.
- **The preview captures at a fixed 900×700 while the storybook side is full-page**, so
  anything taller than 700px has its tail cut out of the comparison.
  `cfg.overrides.<Name>.viewport` raises it, at the cost of re-grading that component.
- **A component hidden at the capture width is invisible to the comparison, not broken**
  — `BottomNav` is `md:hidden`, so at 900px it is `display: none` on both panels. Its
  viewport override is what makes it gradable at all, and skipping the story instead
  would leave its card showing `HeaderNav`, a different component.
- **A no-device state is the intended render.** The capture browser grants no MIDI
  permission and neither does storybook, so "No inputs detected" on both sides is a
  match. Stories that need a connected device mount their own `MidiProvider` over
  `fakeMidi`, which shadows `cfg.provider`.

- **`[RENDER_BLANK]` on BottomNav is benign.** The render check screenshots every card at
  a default 1200px, and the bar is `md:hidden`, so it is `display: none` there and the PNG
  is empty. The card declares `viewport="390x844"` in its own `@dsCard` marker, and at
  that size it renders the real bar. No frame can defeat a viewport media query, so this
  warning cannot be cleared — confirm the card at 390px rather than reworking the preview.

## The pane does not index from the markers here

Uploading the bundle is not enough to make the cards appear. The Design System pane builds
its index from `_ds_manifest.json`, which the app compiles from each card's first-line
`@dsCard` marker — and for this project it never compiled one, however often the
`_ds_needs_recompile` sentinel was re-armed. The markers upload intact (fetch any card back
and its first line is there); the manifest simply stays a 404.

What makes the cards appear is registering them explicitly: `DesignSync register_assets`
with all 69, each with its own capture viewport. Do that after the upload, and re-arm the
sentinel afterwards.

The matching hazard: an explicit registration outlives the file it points at. A card
registered at a path that is later deleted leaves the pane broken rather than merely
missing an entry — which is what happened when the hand-made cards were replaced.
`unregister_assets` the old paths whenever registered files move or go.

## Re-sync risks

- **Build the reference storybook AFTER `node .design-sync/messages-en.mjs`, never
  before.** The reference bakes in whatever `app/paraglide/` held at build time, so a
  reference built while the tree was English-only carries `locales=["en"]` and every
  story naming another language throws `Invalid locale` on the reference side alone. The
  build succeeds and every other story renders, so nothing surfaces it but the one
  component that needs the second language.

- The reference storybook is not built by any repo gate, so nothing else would catch it
  breaking. Rebuild it whenever `.storybook/` or a story changes:
  `nix develop --command npx storybook build -c .storybook -o "$PWD/.design-sync/sb-reference"`.
