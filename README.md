<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

<p align="center">
  <img alt="Plinky" src="public/icon-banner-512.png" width="220">
</p>

<p align="center">A beginner-friendly piano trainer that turns practice into a game.</p>

---

Plug a digital piano into your browser and Plinky guides you through a score — you
read the notation, play it over MIDI, and it grades how you do. No piano handy? Play
along on your computer keyboard or the on-screen piano instead. Everything runs in
the browser; nothing is uploaded, and your scores stay on your device. And if that
device's storage ever fills up or gets blocked, Plinky says so — a banner warns that
progress isn't being saved, and saving a take tells you when it didn't land instead
of pretending it did.

## Practising a score

Open any score and Plinky renders it as real notation, led by a single action:
**Practice**. Pressing it drops into **full screen** — the score and keyboard to
themselves, the screen kept awake (and on a phone the browser's URL bar reclaimed for
the music) — and starts a note-by-note guide: read the note, play it, and the cursor
advances, sounding back what you played. Full screen is where the rest of the play
controls live, so it's the same generous surface on a phone or a wide desktop alike.
There you'll also find **Listen**, which plays the piece back so you hear it first,
lighting up each note as it sounds so your eye can follow along. Listen and Practice
**hand off to each other** — let the computer play a tricky passage then take over
mid-phrase, or play a while and hand it back — and your place is kept, even if you
step out of full screen and come back to it; the **restart** control (or finishing
the run) returns you to the top. The notes keep their colour as you switch, so the
score tells the story of how it was played — **blue** where the computer played,
**green** where you did. The
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
Single notes, **chords**, and **two-hand grand staffs** all work the same. Turn on
**Loop** and the piece repeats whole; to drill just a passage, **tap two bars on the
score** — they fill **red** so the stretch you're repeating is clear, and the range
(with a *Whole song* reset) sits right beside the score, so you can also set the first
and last bar by number. Turn on
**Keep going** and a missed note no longer freezes you — playing the next one moves the
score along, so one hand's slip never stops the other. And for ear training, turn on
**Hidden notes**: the noteheads start blank (the staff and rhythm stay), you Listen to
the phrase first, and each note reveals itself as you find it — **green** when you get
it, **red** once your tries run out (1 by default, up to 3), so the score you finish
with is the story of what your ear caught.

Right in full screen, a **finger-positions** button swaps the keyboard for a fingering
editor: every note arrives pre-fingered with the optimal choice for your measured hand
span, and you tap a note then one of the **ten fingers** below to override it — saved
per piece, with the green/amber/red flow feedback always on. While it's open the score
washes its bars red by **fingering difficulty**, a heat-map that shows at a glance
where the piece actually gets hard — spot the deep-red bars, tap them into a loop, and
drill exactly there.

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
  [ASAP dataset](https://github.com/fosfrancesco/asap-dataset) and
  [DCMLab](https://github.com/DCMLab) corpora of solo-piano classical scores
  (Beethoven, Chopin, Schumann, Grieg, Liszt, Tchaikovsky and more), and public-domain
  choral works from [CPDL](https://www.cpdl.org) (Palestrina, Victoria, Byrd, Tallis…)
  reduced to a two-staff piano grand staff — each credited under its own licence, linked
  from the play page.
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
- **Your runs** — every play page has a **Runs** tab (and a button beside Practice
  that jumps to it) giving your saved performances the whole page, so the feature is
  there to find before you've saved a thing: with nothing yet, it tells you how to make a run (play a piece through, then save
  it). Each piece keeps your last few, each showing the **grade and the accuracy, timing
  and flow** it earned so you can compare attempts at a glance: **replay** one and it plays
  back onto the staff in your own timing — on a MIDI piano, even how long you held each key,
  so your articulation comes back too — **download** it as MIDI or MusicXML, **save it as
  a video** (an MP4 of your take: the sheet music of what you played with each note
  tinting as it sounds, above the keyboard where each press lights its key in full
  and fades while held, so even fast repeats read clearly — with the piece's title, composer
  and licence burnt in, ready for any chat or feed — offered on browsers that can encode
  one, Chrome and friends today — pick **16:9 or 9:16** right beside Save), **challenge a
  friend** to race it by link, or delete it. From the top of the tab you can **challenge
  a friend with your last run** straight away, no save needed. Your fastest complete run is
  the **ghost** you race next time — racing is on by default and toggles off under the
  score's practice options.
- **Assignments** — a built-in **First steps** set (the demo tunes, then the easiest
  studies) is ready to play on day one; beyond it, build an ordered practice list for
  a student (or yourself): browse
  or search the whole catalogue page by page, add pieces, drag titles into the
  right order (or use the arrow buttons), and give each an optional target tempo
  and note, plus a free-form description for the whole set. The page splits into
  two tabs — your assignments, and the one you're creating or editing. Save it,
  **edit it later**, share it by link, or pass it around as a file; each piece
  checks off as it's learned. A step whose piece is no
  longer on the device (a deleted import, a link from elsewhere) is labelled as
  missing instead of leading to a dead end, and a one-tap action prunes those steps;
  importing a shared assignment says up front how many of its pieces resolve here,
  and deleting a score from the Library warns when saved assignments still use it.
- **You** — your one progress page: the grade you're at on the eight-grade ladder and
  what's left to reach the next, your skill rating, days practised and notes played, a
  slow-moving fingerprint of your Accuracy, Timing and Flow, and the
  pieces **due for review** — with a one-tap review session to refresh them. Each grade
  carries an optional *About this grade* note.

On the **home page**, a gentle, dismissible **Getting started** checklist explains how
Plinky works and walks the first session in order — set yourself up (hand size and key
mapping first, so everything after is tailored to you), then play your first piece (your
first assignment when you have one) — before pointing out the app's other corners. The
steps that put your fingers on keys right away carry a small **Jump right in** marker,
the shortcut for anyone who'd rather play first and configure later. The **Today**
panel alongside it lists the day's practice as one-tap links — pieces due for review,
the daily challenge, and **your open assignment's next step** ("Continue *First
steps* — step 2 of 5"), which goes straight into that piece; while an assignment is
open, its next step stands in for the generic something-new suggestion, so the path
you (or your teacher) chose is always one tap from the front page. The first time you
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
- **With your computer keyboard** — the bottom letter row plays the left hand
  (`Z X C V B N M` the white keys, `S D G H J` the black) and the top row the
  right hand an octave up (`Q W E R T Y U` white, `2 3 5 6 7` black), each a full
  C-to-B octave, with an octave shift to move around; remap any of these keys to
  your own layout in **Settings**. (Two-hand pieces span both staves, so a MIDI
  keyboard is the comfortable way to play those.)
- **With the on-screen piano** — tap the keys shown under each score. On a wide-ranging
  piece the keyboard shows a moving window that follows the notes you're playing, so the
  keys never shrink to slivers; set its width — **1, 2 or 3 octaves, or the whole piece**
  fixed — in the *Practice tools* drawer. Handy on a phone or tablet with no MIDI or keyboard.

Still learning where the notes are? The keys can carry their **note names** — every key,
or just the C keys as orientation landmarks (the white key left of each pair of black
keys), or none once the map is second nature — set under **Settings**. The C landmarks
show by default.

Every keyboard shows a small badge in its corner — a green tick the moment a MIDI
piano is connected, a quiet plug otherwise — so you can see at a glance whether your
instrument is hooked up.

Sound is synthesised in the browser, so the on-screen and computer keyboards make
sound everywhere — MIDI is only for *input* from a real piano. iPhones normally mute
browser audio under **Silent Mode**, so Plinky declares itself a playback audio
session (iOS 16.4+) to play through it like a music app, and re-wakes sound after a
call or app switch interrupts it. On an older iPhone, or if you still hear nothing,
turn Silent Mode off (the side switch, or the Action button on iPhone 15 Pro and
later) and turn the volume up — Plinky shows a one-time reminder on iOS. Opening
Plinky from inside a social app (Instagram, TikTok, Facebook, …) runs it in an
embedded browser that blocks sound outright; there the reminder points you to open
the page in Safari instead.

Plinky installs from your browser like an app and works offline once loaded. When
a new version ships it waits quietly rather than reloading mid-task: a banner
offers it, and the app updates only when you choose to reload. Even when an
update arrives from another tab, a reload never interrupts a run in progress —
it waits for the run to finish. And if updates can't be installed on a device at
all, Plinky says so in a dismissible notice instead of silently falling behind.

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

## News banner

The home page can show a small "what's new" picture that links somewhere — a new
piece, an announcement, a seasonal note. It's optional and edited outside the code
so anyone can change it live, with no redeploy: the running app fetches the current
item from a [Sanity](https://www.sanity.io) project at load time. The document
schemas live in [studio/](studio/), and every change to them redeploys the hosted
Studio from CI.

To connect it, copy `.env.example` to `.env.local` and set `VITE_SANITY_PROJECT_ID`
and `VITE_SANITY_DATASET`. In Sanity, add a `news` document type with an `image`
(plus `alt` text), a `link` URL, an optional `headline`, and a `show` boolean, and a
singleton `siteSettings` document with a `newsEnabled` boolean — the master switch
for the whole board. The editor uploads a picture and publishes, and the banner
appears; flipping `newsEnabled` off (or a single item's `show` off) hides it again,
all without a redeploy. Only `https` image and link URLs are shown, and a missing or
unreachable source simply shows nothing — the banner never blocks or breaks the
page. Leave the variables unset and no banner appears and no network call is made.

## Help page

The **?** in the header opens a help page that explains Plinky area by area — one
section per part of the app, and it drops you on the section for the page you came
from. Like the news banner, the content is edited outside the code in the same
[Sanity](https://www.sanity.io) project, so anyone can write and update it live with
no redeploy, and it's translated: a reader downloads only their own language.

The app owns the sections (their titles are translated with the rest of the UI); Sanity
holds the blocks inside them. The `helpItem` document type (see [studio/](studio/)) carries a `pageKey` (which
section it belongs to — `gettingStarted`, `home`, `play`, `library`, `daily`, `compose`,
`assignments`, `you`, `review`, or `settings`), an `order`, an optional `image` (shared
across languages) with internationalized `alt` text, an internationalized `text` body,
and an optional `link`. Publish a block and it appears under its section; a section with
no blocks shows a short "on the way" note. Only `https` image and link URLs are shown,
and an unreachable source falls back to the section skeleton — help never breaks the
page. It reuses the news banner's `VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET`.

## The board

The board is Plinky's pin-board of artists worth following — pianists and
composers the content team wants to put in front of players, each with a
picture, a short blurb, and a follow link. Recognized social links (Instagram,
TikTok, YouTube, X, Bluesky, Threads) get their platform's icon on the follow
button; anything else becomes a plain visit link. Like the news banner and help
page, the content lives in the same [Sanity](https://www.sanity.io) project and
is edited live with no redeploy, and blurbs are translated: a reader downloads
only their own language.

The `boardArtist` document type (see [studio/](studio/)) carries a `name`, an
`image` (shared across languages) with internationalized `alt` text, an
internationalized `text` blurb, a `link` URL, an `order`, and a `show` boolean. Publish an artist and the card
appears; flip `show` off and it disappears, all without a redeploy. Only `https`
image and link URLs are shown, and an unreachable source simply shows an empty
board — the page never breaks. It reuses the news banner's
`VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET`.

## Composer pages

Every composer credited in the catalogue gets a page at `/person/<name>` —
all of their pieces in one place, easiest first, each one tap from being
practised. The composer's name on a play page links there. Spelling variants
across the source corpora ("J.S. Bach", "Johann Sebastian Bach (1685 - 1750)")
are canonicalized so one composer owns one page.

## Follow Plinky

Every page ends with a slim footer linking to Plinky's own channels —
[Instagram](https://www.instagram.com/plinky.piano),
[Facebook](https://www.facebook.com/profile.php?id=61591963944991) and
the source itself on [GitHub](https://github.com/metio/plinky).

## Development

The project builds with Node.js and npm:

```sh
npm install      # install dependencies
npm run dev      # start the dev server
npm run typecheck
npm test
npm run arch     # check the layered-architecture rules
npm run build    # emit the static site to build/client
npm run scores   # regenerate the bundled exercise scores
npm run mutation # measure test quality with Stryker (see below)
```

`npm run mutation` runs [Stryker](https://stryker-mutator.io) over the pure
`core/` layer: it rewrites the code with small faults and reruns the tests, so a
surviving mutant marks an assertion the suite is missing — a gap that line
coverage can't reveal. It is a slow, manual quality check, not part of the CI
gate; the score is ratcheted in `stryker.config.mjs`.

The codebase is a stack of layers — a pure `core/` domain under an app of ports,
adapters, stores and components — described in [ARCHITECTURE.md](ARCHITECTURE.md)
and enforced by `npm run arch`. A pull request runs typecheck, tests, the
architecture check, and a production build; merging to `main` publishes the built
site to <https://plinky.fun>.

## License

[0BSD](LICENSES/0BSD.txt), [REUSE](https://reuse.software)-compliant.
