<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-horizontal-dark.svg">
    <img alt="Plinky" src="public/logo-horizontal.svg" width="360">
  </picture>
</p>

<p align="center">A beginner-friendly piano trainer that turns practice into a game.</p>

---

Plug a digital piano into your browser and Plinky guides you through short
exercises — showing the next note to play, listening over MIDI, and scoring how
you do. No piano handy? Play along on your computer keyboard instead. Everything
runs in the browser; nothing is uploaded, and your best scores stay on your
device.

## Practice modes

- **Practice** — a sheet-music phrase with the next note highlighted. Play it and
  the cursor advances; the note sounds back so you hear what you played.
- **Time trial** — race through a phrase as fast and cleanly as you can. The
  clock starts on your first note, wrong notes add a penalty, and your best run
  per exercise is remembered.
- **Rhythm** — a metronome counts you in and keeps time while you play; each note
  is rated on how close it lands to the beat, with the tightest run kept as your
  best.

The exercise library covers scales (C, G, D, F major), a C major arpeggio, the A
minor pentatonic, and familiar melodies like *Twinkle, Twinkle* and *Ode to Joy*.

## Playing

- **With a digital piano** — connect it over USB or Bluetooth MIDI and click
  *Connect MIDI*. Web MIDI is available in Chrome, Edge, and Firefox on desktop
  and Android; Safari and iOS do not expose it, so use the keyboard fallback
  there.
- **With your computer keyboard** — the home row maps to a playable octave, so
  you can try every mode without hardware. An octave shift lets you reach notes
  outside it.

## How it works

A single-page app built with [React Router 7](https://reactrouter.com) in SPA
mode. [Web MIDI](https://developer.mozilla.org/docs/Web/API/Web_MIDI_API)
delivers note input, [Web Audio](https://developer.mozilla.org/docs/Web/API/Web_Audio_API)
drives the metronome and the synthesized playback from one shared audio clock,
and [abcjs](https://www.abcjs.net) renders the notation and tells the trainer
which pitch each note expects.

## Development

The project builds with Node 22 and npm:

```sh
npm install      # install dependencies
npm run dev      # start the dev server
npm run typecheck
npm test
npm run build    # emit the static site to build/client
```

A pull request runs typecheck, tests, and a production build; merging to `main`
publishes the built site to <https://plinky.projects.metio.wtf>.

## License

[0BSD](LICENSES/0BSD.txt), [REUSE](https://reuse.software)-compliant.
