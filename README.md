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

Plug a digital piano into your browser and Plinky guides you through a score —
showing the next note to play, listening over MIDI, and grading how you do. No
piano handy? Play along on your computer keyboard instead. Everything runs in the
browser; nothing is uploaded, and your scores stay on your device.

## Practising a score

Open any score and Plinky renders it as real notation. **Listen** plays it back so
you hear it first; **Practice** turns the same cursor into a note-by-note guide —
play the highlighted note and the cursor advances, sounding back what you played.
Wrong notes are ignored so you can hunt for the right key, single notes, **chords**,
and **two-hand grand staffs** all the same.

When you finish, the run is **graded S–F** from three things:

- **Accuracy** — how many notes you found cleanly.
- **Timing** — how close each note landed to where the notation puts it.
- **Flow** — whether you kept moving like a musician rather than stopping to hunt.

A **ghost timeline** then plots the ideal onsets against yours so you can see where
you rushed or dragged, and once you clear a score it enters **spaced repetition** —
Plinky resurfaces it for review on a widening schedule so it actually sticks.

## Modes

- **Scores** — the catalogue: bundled scales, arpeggios, and familiar tunes like
  *Twinkle, Twinkle* and *Ode to Joy*, plus anything you import. Search, star, and
  open one to practise.
- **Sprint** — a sight-reading drill on freshly generated notes; a new phrase
  every run, graded the same as any score.
- **Daily challenge** — one score, the same for everyone that day, that you can
  share as a "Plinky #N" grid. Come back tomorrow for a new one.
- **Ear training** — hear a note and find it by ear, in any octave.
- **Tracks** — ordered, Duolingo-style paths through the catalogue; nothing is
  locked, the order is a suggestion, and a step is cleared once you've learned it.
- **Curriculums** — your imported scores grouped by the packs a teacher or school
  shared with you.
- **Progress** — your day streak, days practised, and notes played, plus a
  slow-moving fingerprint of your Accuracy, Timing, and Flow over recent sessions.

## Sharing

Every graded run can become a **Wordle-style grid** — three rows (Accuracy, Timing,
Flow) across six moments, no numbers — to copy, post, or save as an image. The
daily challenge shares as **Plinky #N** so everyone compares the same run, and the
Progress page shares your lifetime fingerprint.

## Bring your own scores

Upload a **MusicXML** file (`.musicxml`/`.xml`) exported from MuseScore, Sibelius,
Finale, or Dorico — or paste it — and it joins your catalogue, playable and graded
like any other, saved on your device. Export your library as a pack to back it up
or hand it to a student, and **submit a score to the shared catalogue** through a
prefilled GitHub issue — no account beyond your own, no backend.

## Playing

- **With a digital piano** — connect it over USB or Bluetooth MIDI and click
  *Connect MIDI*. Web MIDI is available in Chrome, Edge, and Firefox on desktop
  and Android; Safari and iOS do not expose it, so use the keyboard fallback there.
- **With your computer keyboard** — `A S D F G` plays the left hand and
  `H J K L ;` the right, each a five-finger C–G position, with an octave shift to
  move around. (Two-hand pieces span both staves, so a MIDI keyboard is the
  comfortable way to play those.)
- **With the on-screen piano** — tap the keys shown under each score; the next note
  to play is highlighted. Handy on a phone or tablet with no MIDI or keyboard.

Plinky installs from your browser like an app and works offline once loaded.

## How it works

A single-page app built with [React Router](https://reactrouter.com) in SPA mode.
[Web MIDI](https://developer.mozilla.org/docs/Web/API/Web_MIDI_API) delivers note
input and [Web Audio](https://developer.mozilla.org/docs/Web/API/Web_Audio_API)
drives playback from one shared audio clock.
[OpenSheetMusicDisplay](https://opensheetmusicdisplay.org) renders MusicXML, and
Plinky walks its cursor to match the pitches under each position against what you
play — the same engine behind every mode.

## Translations

Plinky speaks 26 languages, and contributions are welcome — see
[TRANSLATING.md](TRANSLATING.md) for how to add a translation. Untranslated strings
fall back to English, so every language always works while it catches up.

## Development

The project builds with Node.js and npm:

```sh
npm install      # install dependencies
npm run dev      # start the dev server
npm run typecheck
npm test
npm run build    # emit the static site to build/client
npm run scores   # regenerate the bundled exercise scores
```

A pull request runs typecheck, tests, and a production build; merging to `main`
publishes the built site to <https://plinky.fun>.

## License

[0BSD](LICENSES/0BSD.txt), [REUSE](https://reuse.software)-compliant.
