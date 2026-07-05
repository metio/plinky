<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Architecture

Plinky is a client-rendered React Router app assembled from a stack of layers. The one
rule that holds the whole thing together: **dependencies point strictly downward.** A
layer may import from the layers below it and never from a layer above. `dependency-cruiser`
enforces this on every push (`npm run arch`); the contract lives in `.dependency-cruiser.cjs`.

```text
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
capability (`KeyValueStore`, `AudioEngine`, `Fetcher`, `MidiAccessPort`, the MusicXML
`XmlCodec`) with no implementation. A unit that needs a side effect depends on the *interface*, so a test can
hand it a fake. OpenSheetMusicDisplay is the exception — a stateful rendering engine the
surface drives directly rather than through a fake-able port — so it is *fenced* to the
component/hook layer by a dependency rule instead.

**`app/adapters/`** — the concrete browser implementations of the ports (`browserStore` over
`localStorage`, the `webAudioEngine`, the `domXmlCodec`, the `httpFetcher`, the `webMidi`
access) and their test fakes (`memoryStore`, `fakeAudioEngine`, `fakeMidi`, …). This is the
only layer that talks to the platform.

**`app/stores/`** — single sources of truth for persistent state (preferences, mastery,
history, …) and the fetched catalogue sources, built over the ports and exposed as
`useSyncExternalStore` snapshots so every view of a value reads the same place and re-renders
together when it changes.

**`app/lib/`** — the residual middle, now singleton-free: the storage-backed catalogue
(parametric over the injected store, holding the app's one Vite `import.meta.glob`), the
OSMD-coupled score painting, and a few helpers that compose stores with core logic. What
needs a capability takes it as a parameter.

**`app/hooks/`** — the React glue that binds stores and adapters into the component lifecycle.

**`app/components/ui/`** — pure presentational primitives (button, chip, switch, …): props
in, elements out. They compose `core` and each other, nothing below-and-sideways. Rendered
and tested in isolation.

**`app/components/features/`** — containers that compose the primitives with hooks and
stores, receiving their capabilities (state stores, audio, MIDI, the network) from the
`AppServices` context rather than importing singletons.

**`app/routes/`** — pages assembled from features. The concrete adapters are wired in by
the composition roots — the services context (`app/contexts/services.tsx`) and the app root
(`app/root.tsx`); the play route's static `meta()` is the one documented exception, since the
router calls it outside the React tree.

## Why this shape

The payoff is leverage through composition: a handful of small, independent, well-named
pieces combine into many capabilities instead of each feature adding its own bespoke code.
Pure logic that can be tested without mocks, side effects isolated behind a seam you can
fake, and one place to read each piece of shared state — so the parts stay swappable and the
whole stays reasonable as it grows.

Declarative composition is the idiom (see `app/components/features/conditional.tsx`): conditions and
injected capabilities are named components (`Show`, `Midi`, `Media`, `ServicesProvider`) that
read from context, so a screen reads like a description of what it is rather than a tangle of
flags and prop-drilling.

## Injecting capabilities: the provider pattern

Every external integration a component needs — persistence, audio, MIDI, the score renderer,
the network — is handed to it through a context, never reached for directly. A wrapper high in
the tree holds the real integration (`ServicesProvider` in `app/contexts/services.tsx`, the
`MidiProvider` beside it); the component that performs the work receives its capability and
stays **oblivious to which implementation it got** — the browser adapter in production, a fake
in a test. So a feature renders in a test by wrapping it in a provider carrying fakes
(`<ServicesProvider services={{ store: memoryStore() }}>`) — no jsdom globals to stub, no
module to mock. The `AppServices` set grows one field per port as each lands; call sites prefer
the narrow hook (`useStore()`) so a component declares exactly what it depends on.

## What `dependency-cruiser` does and does not catch

It reads the import graph, so it enforces the *edges*: no cycles, `core` importing nothing
above it, `ports` staying implementation-free, each layer pointing down. It cannot see a
reference to a global (`localStorage`, `document`, `fetch`) because that is not an import —
those are checked by `dev/check-globals.mjs` (part of `npm run arch`), which pins each
confined global to the adapter allowed to touch it: `localStorage` to the browser store,
`DOMParser`/`XMLSerializer` to the XML codec, `requestMIDIAccess` to the Web MIDI adapter,
`AudioContext` to the audio engine. Core notation functions take the codec as a parameter,
so they run identically in the browser, in Node tooling (a linkedom-backed codec), and in
tests.
