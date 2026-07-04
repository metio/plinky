<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Architecture

Plinky is a client-rendered React Router app assembled from a stack of layers. The one
rule that holds the whole thing together: **dependencies point strictly downward.** A
layer may import from the layers below it and never from a layer above. `dependency-cruiser`
enforces this on every push (`npm run arch`); the contract lives in `.dependency-cruiser.cjs`.

```
routes ──▶ components/features ──▶ components/ui ──▶ core
              │                       │
              ▼                       ▼
            hooks ──▶ stores ──▶ ports ◀── adapters
              └──────────┴─────────┴──────────┘

core ◀── dev/ , react-router.config.ts        (core has no outward edges)
```

## The layers

**`core/`** (repo root) — pure domain: music theory, grading, notation parsing/writing,
scoring, share codes, IDs. No React, no OSMD, no browser globals, no I/O. Every function is
deterministic and unit-testable without a single mock. Time is passed in as a `now: number`
argument rather than read from a clock. Because it is pure and self-contained, the `dev/`
import scripts and the build config (`react-router.config.ts`) depend down on it too — the
same music tooling the app runs.

**`app/ports/`** — the injection seams: TypeScript interfaces describing a side-effecting
capability (`KeyValueStore`, `AudioEngine`, `MidiAccess`, `Fetcher`, a MusicXML parser, the
score renderer) with no implementation. A unit that needs a side effect depends on the
*interface*, so a test can hand it a fake.

**`app/adapters/`** — the concrete browser implementations of the ports (`browserStore` over
`localStorage`, the Web Audio synth, Web MIDI, `fetch`, OSMD) and their test fakes
(`memoryStore`, …). This is the only layer that talks to the platform.

**`app/stores/`** — single sources of truth for persistent state (preferences, mastery,
history, …), built over the storage port and exposed as `useSyncExternalStore` snapshots so
every view of a value reads the same place and re-renders together when it changes.

**`app/hooks/`** — the React glue that binds stores and adapters into the component lifecycle.

**`app/components/ui/`** — pure presentational primitives (button, chip, switch, …): props
in, elements out. They compose `core` and each other, nothing below-and-sideways. Rendered
and tested in isolation.

**`app/components/features/`** — containers that compose the primitives with hooks and
stores, receiving the render-variable ports (audio, MIDI, renderer) from an `AppServices`
context rather than importing singletons.

**`app/routes/`** — the composition root: it assembles features into pages and wires the
concrete adapters into the services context.

## Why this shape

The payoff is leverage through composition: a handful of small, independent, well-named
pieces combine into many capabilities instead of each feature adding its own bespoke code.
Pure logic that can be tested without mocks, side effects isolated behind a seam you can
fake, and one place to read each piece of shared state — so the parts stay swappable and the
whole stays reasonable as it grows.

Declarative composition is the idiom (see `app/components/conditional.tsx`): conditions and
injected capabilities are named components (`Show`, `Midi`, `Media`, `AppServices`) that read
from context, so a screen reads like a description of what it is rather than a tangle of
flags and prop-drilling.

## What `dependency-cruiser` does and does not catch

It reads the import graph, so it enforces the *edges*: no cycles, `core` importing nothing
above it, `ports` staying implementation-free, each layer pointing down. It cannot see a
reference to a global (`localStorage`, `document`, `fetch`) because that is not an import —
`core`'s freedom from browser globals is enforced instead by compiling it against a DOM-free
`lib`, and by keeping the platform confined to `app/adapters/`.
