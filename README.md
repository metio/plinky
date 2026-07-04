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

Open any score and Plinky renders it as real notation, led by a single action:
**Practice**. Pressing it drops into **full screen** — the score and keyboard to
themselves, the screen kept awake (and on a phone the browser's URL bar reclaimed for
the music) — and starts a note-by-note guide: read the note, play it, and the cursor
advances, sounding back what you played. Full screen is where the rest of the play
controls live, so it's the same generous surface on a phone or a wide desktop alike.
There you'll also find **Listen**, which plays the piece back so you hear it first,
lighting up each note as it sounds so your eye can follow along. The
staff **scrolls to follow the cursor** as you go, so a multi-line piece keeps up with
you instead of making you scroll — and it stays in its own box so the keyboard below
never hides the notes. On a phone — in either orientation — a compact **focus strip**
sits right above the keys showing the bar you're playing, so the notes you need are
never out of reach. An **(X)** leaves full screen, and right there while
you play are toggles to **follow the note** (auto-scroll on/off), show the **finger-position
numbers**, **restart** the run, or fold the keyboard away for more notation if you're at
a real piano. You can
also force a **set number of bars per row** for bigger, more readable notation on a
small screen, or switch to **treadmill** reading — the piece laid out as one continuous
line that scrolls under a fixed gaze as you play, so your eyes rest in one place. **Bar
numbers** on each row's first bar make a passage easy to find (and line up with the
loop's from/to), or you can turn them off for a cleaner staff. A
wrong key flashes red; whether the correct key then lights up is your call — read
the music unaided, get a nudge only after a slip, or always show the next note.
Single notes, **chords**, and **two-hand grand staffs** all work the same. To drill a
tricky passage, **tap a bar to start a loop and another to end it** — the chosen bars
fill **red** so the stretch you're repeating is clear (or set the first and last bar by
number). Turn on
**Keep going** and a missed note no longer freezes you — playing the next one moves the
score along, so one hand's slip never stops the other.

Practice is self-paced by default, but flip on **Keep up** and it becomes tempo-locked:
after a one-bar count-in, the cursor advances on the beat whether or not you're ready, and
any note you don't catch before it passes is a miss (Synthesia / Guitar-Hero style). The
notes sound as a guide so you can follow along by ear — or turn that off to read them at
tempo yourself. At the end it tells you how many you kept up with.

When you finish, a short **major flourish** plays to mark the moment — landing a
beat after your last note so it reads as a reward rather than a sound on top of your
playing. A fuller arpeggio marks a stronger grade, a warm lift a gentler one, never a
downer (it follows the sound setting, so muting silences it). The run is then **graded S–F**
from three things:

- **Accuracy** — how many notes you found cleanly.
- **Timing** — how evenly you held the rhythm. Practice is self-paced, so timing is
  judged against your *own* tempo — a steady run at any speed reads as in time, and
  only a note that breaks your pace counts as off. Tapping on a phone or computer
  keyboard can't be as precise as real keys, so those get a wider window.
- **Flow** — whether you kept moving like a musician rather than stopping to hunt.

A **per-note strip** and a **tempo graph** then show where you rushed or dragged, and on
a two-hand piece a line calls out **which hand lagged** (or that they kept pace). You
can **race a ghost** of your previous best — or a friend's run, shared by link —
with a marker tracking along the staff. Once you clear a score it enters **spaced
repetition**, resurfacing for review on a widening schedule so it actually sticks — a
one-tap **review session** walks you through everything that's fading, and you can
**shelve** anything you're not working on right now.

## Modes

- **Library** — the catalogue: bundled scales, arpeggios, and familiar tunes like
  *Twinkle, Twinkle* and *Ode to Joy*, plus anything you import. Search, star, filter
  by kind, grade, or what's **due now**, and open one to practise. Each piece credits
  its **licence and source** — the catalogue is drawn from
  [PDMX](https://github.com/pnlong/PDMX) and the CC0
  [OpenScore Lieder](https://github.com/OpenScore/Lieder) corpus, the
  CC-BY-NC-SA [KernScores](https://github.com/craigsapp) corpora (Scarlatti, Mozart,
  Haydn and Joplin, and Bach's 370 chorales reduced to a two-staff piano grand staff),
  solo-keyboard pieces from the [Mutopia Project](https://www.mutopiaproject.org)
  (public-domain, CC-BY and CC-BY-SA), and the CC-BY-NC-SA
  [ASAP dataset](https://github.com/fosfrancesco/asap-dataset) of solo-piano classical
  scores (Beethoven, Bach, Chopin, Liszt and more) — each credited under its own
  licence, linked from the play page.
- **Daily challenge** — one freshly generated phrase, the same for everyone that day,
  graded and shareable as a "Plinky #N" grid; play it whenever you like, with no
  streak to keep up. Once played, re-opening the day's challenge shows your result
  again. A **Warm up** tab drills unlimited fresh phrases to prepare for it.
- **Compose** — improvise freely and Plinky captures every note, sketching it onto
  a staff to share or export (see below).
- **Any piece, three ways** — open a score and a tab bar switches how you work it:
  **Play** (read, hear, and practise it), **Ear** (hear a two-bar phrase and play it
  back), or **Finger Position** (choose the finger positions for a two-bar window; each
  note lights **green/amber/red** as you go — with a symbol too, so it reads without
  colour, and you can fade it off — to show how the move flows, it's scored against the
  most economical finger positions for your hand, the two bars you're on are
  **highlighted in the full piece** so you keep your place, and it's **saved per piece**
  so the positions you work out are there when you come back).
- **Your takes** — after a run, save it as a take. Each piece keeps your last few, each
  showing the **grade and the accuracy, timing and flow** it earned so you can compare
  attempts at a glance: **replay** one and it plays back onto the staff in your own
  timing — on a MIDI piano, even how long you held each key, so your articulation comes
  back too — **download** it as MIDI or MusicXML, **challenge a friend** to race it by
  link, or delete it. You can also
  **challenge a friend with your last run** straight away, no save needed. Your fastest
  complete take is the **ghost** you race next time — racing is on by default and toggles
  off under the score's practice options.
- **You** — your one progress page: the grade you're at on the eight-grade ladder and
  what's left to reach the next, your skill rating, days practised and notes played, a
  slow-moving fingerprint of your Accuracy, Timing and Flow, and the
  pieces **due for review** — with a one-tap review session to refresh them. Each grade
  carries an optional *About this grade* note.

On the **home page**, someone who has never played piano is met by a **New to piano?**
card that hands them a first short song and a reassurance that reading notation comes
later — it disappears the moment you've played anything. Alongside it, a gentle,
dismissible **discovery checklist** points out the app's corners, and the first time you
open a score a one-time tip explains the three modes and the listen-then-play-slowly
loop — a guided tour where you land, never a gate on progress.

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

Every graded run can become a **Wordle-style grid** — six moments in five colour bands,
no numbers — to copy, post, or save as an image. Each cell folds Accuracy, Speed and
Timing into one square, coloured by the **weakest** of the three, so a moment is only as
good as its shakiest aspect. Unlike the practice grade, which stays gently self-paced,
the card is an honest snapshot: Speed scores how close you played to the piece's own
tempo, so a slow, careful run (a mouse plodding across the on-screen keys) shows red even
with every note right. And it's **one row per hand** — a single row for a one-hand piece,
a **right** row over a **left** row once both hands are in play, so a lagging hand shows
as a redder line against the other. The daily challenge shares as **Plinky N**, so
everyone compares the same run, and the You page shares your lifetime fingerprint of the
practice grade (Accuracy, Timing and Flow).

Earned moments also surface their own **milestone card** on the run summary — your
first S on a piece, reaching a new grade, or a flawless run — to share or save. Each
appears at most once and never interrupts; it just waits beside your results.

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
  move around; remap any of these keys to your own layout in **Settings**. (Two-hand
  pieces span both staves, so a MIDI keyboard is the comfortable way to play those.)
- **With the on-screen piano** — tap the keys shown under each score. On a wide-ranging
  piece the keyboard shows a moving window that follows the notes you're playing, so the
  keys never shrink to slivers; set its width — **1, 2 or 3 octaves, or the whole piece**
  fixed — under *More options*. Handy on a phone or tablet with no MIDI or keyboard.

Still learning where the notes are? The keys can carry their **note names** — every key,
or just the C keys as orientation landmarks (the white key left of each pair of black
keys), or none once the map is second nature — set under **Settings**. The C landmarks
show by default.

Every keyboard shows a small badge in its corner — a green tick the moment a MIDI
piano is connected, a quiet plug otherwise — so you can see at a glance whether your
instrument is hooked up.

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
