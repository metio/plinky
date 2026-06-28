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

Plug a digital piano into your browser and Plinky guides you through a score — you
read the notation, play it over MIDI, and it grades how you do. No piano handy? Play
along on your computer keyboard or the on-screen piano instead. Everything runs in
the browser; nothing is uploaded, and your scores stay on your device.

## Practising a score

Open any score and Plinky renders it as real notation. **Listen** plays it back so
you hear it first; **Practice** turns the same cursor into a note-by-note guide —
read the note, play it, and the cursor advances, sounding back what you played. The
staff **scrolls to follow the cursor** as you go, so a multi-line piece keeps up with
you instead of making you scroll — and it stays in its own box so the keyboard below
never hides the notes. You can also force a **set number of bars per row** for bigger,
more readable notation on a small screen. A
wrong key flashes red; whether the correct key then lights up is your call — read
the music unaided, get a nudge only after a slip, or always show the next note.
Single notes, **chords**, and **two-hand grand staffs** all work the same.

When you finish, the run is **graded S–F** from three things:

- **Accuracy** — how many notes you found cleanly.
- **Timing** — how close each note landed to where the notation puts it.
- **Flow** — whether you kept moving like a musician rather than stopping to hunt.

A **per-note strip** and a **tempo graph** then show where you rushed or dragged, and
you can **race a ghost** of your previous best — or a friend's run, shared by link —
with a marker tracking along the staff. Once you clear a score it enters **spaced
repetition**, resurfacing for review on a widening schedule so it actually sticks — a
one-tap **review session** walks you through everything that's fading, and you can
**shelve** anything you're not working on right now.

## Modes

- **Library** — the catalogue: bundled scales, arpeggios, and familiar tunes like
  *Twinkle, Twinkle* and *Ode to Joy*, plus anything you import. Search, star, filter
  by kind, grade, or what's **due now**, and open one to practise.
- **Daily challenge** — one freshly generated phrase, the same for everyone that day,
  graded and shareable as a "Plinky #N" grid, with a **streak** for coming back. A
  **Warm up** tab drills unlimited fresh phrases to prepare for it.
- **Compose** — improvise freely and Plinky captures every note, sketching it onto
  a staff to share or export (see below).
- **Any piece, three ways** — open a score and a tab bar switches how you work it:
  **Play** (read, hear, and practise it), **Ear** (hear a two-bar phrase and play it
  back), or **Fingering** (choose a fingering for a two-bar window; each note lights
  **green/amber/red** as you go — with a symbol too, so it reads without colour, and you
  can fade it off — to show how the move flows, it's scored against the most
  economical fingering for your hand, the two bars you're on are **highlighted in the
  full piece** so you keep your place, and it's **saved per piece** so the fingering you
  work out is there when you come back).
- **You** — your one progress page: the grade you're at on the eight-grade ladder and
  what's left to reach the next, your skill rating, your day streak, days practised and
  notes played, a slow-moving fingerprint of your Accuracy, Timing and Flow, and the
  pieces **due for review** — with a one-tap review session to refresh them.

## Composing

Play whatever you like — on a MIDI piano, your computer keys, or the on-screen
keyboard — and Plinky records every note and sketches it onto a staff as you go. The
playback is exactly what you played; the staff is an approximate sketch, snapped to a
grid so it reads as notation, with simultaneous notes drawn as chords. Play along to
the **metronome** with a one-bar count-in for a tidier rhythm, set a **checkpoint** to
keep the good part and retry the tail, then **share the take by link** or download it
as **MIDI** or **MusicXML**. Open a MIDI or MusicXML file back in to pick up where you
left off on another device.

## Sharing

Every graded run can become a **Wordle-style grid** — three rows (Accuracy, Timing,
Flow) across six moments, no numbers — to copy, post, or save as an image. The
daily challenge shares as **Plinky #N** with your streak, so everyone compares the
same run, and the You page shares your lifetime fingerprint.

## Bring your own scores

Drag in a **MusicXML** file (`.musicxml`, `.xml`, or compressed `.mxl`) exported from
MuseScore, Sibelius, Finale, or Dorico, and it joins your catalogue — playable and
graded like any other, saved on your device. Preview the staff, set its grade and
details, then add it. Export your whole library as a pack to back it up or hand it to
a student.

## Playing

- **With a digital piano** — connect it over USB or Bluetooth MIDI and click
  *Connect MIDI*; Plinky reconnects it automatically on your next visit. Web MIDI is
  available in Chrome, Edge, and Firefox on desktop and Android; Safari and iOS do
  not expose it, so use the keyboard fallback there.
- **With your computer keyboard** — `A S D F G` plays the left hand and
  `H J K L ;` the right, each a five-finger C–G position, with an octave shift to
  move around. (Two-hand pieces span both staves, so a MIDI keyboard is the
  comfortable way to play those.)
- **With the on-screen piano** — tap the keys shown under each score. Handy on a
  phone or tablet with no MIDI or keyboard.

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
