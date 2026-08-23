<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# The Plinky kit

Everything here is generated. `npm run brand` rebuilds it from `app/app.css` and
`brand/plinky-mark.png`, so the colours in a poster are the colours in the app by
construction — there is no second copy to keep in step. Edit the app; rerun the script.
It reads resolved token values out of the built stylesheet, so a build has to exist
first: `npm run build:single` (or `ci-build`), then `npm run brand`.

| File | What it is |
| --- | --- |
| `plinky-mark.png` | The lockup, and the master: 1024×1024 RGBA, transparent outside the tile's own rounded silhouette. Use it where the name has room to be read. |
| `plinky-icon.png` | The same mark with the wordmark taken out and the keys recentred, 1024×1024 RGBA. Use it wherever the mark is worn small — a tab, a launcher, an app header — where the lockup's own lettering is a smudge. |
| `source/plinky-mark.png` | The artwork as its author supplied it, flattened onto white. `npm run mark` keys it and writes the master. |
| `icon/plinky-*.png` | The mark at 32 · 64 · 180 · 192 · 512 · 1024, transparent outside its own silhouette. |
| `icon/lockup-paper.png` | The mark beside the tagline on paper, 960×320 at 2×, for light surfaces. |
| `icon/lockup-violet.png` | The same on violet, the mark on a paper plate so it keeps its edge. |
| `palette.png` | Every colour with its role, as a sheet. |
| `palette.json` | The same, for tools. Hex plus the token each comes from. |
| `type.png` | The two faces, set as the app sets them. |
| `social/profile-square-*.png` | The profile picture, at 256 · 512 · 800. Built from the **wordless** icon on ink, because every platform crops this one to a circle and shows it at about 56px beside a comment: a circle cuts through a wordmark, and violet on violet loses the tile's edge. |
| `social/open-graph-1200x630.png` | What a shared link unfurls as. |
| `social/square-1080.png` | A square post. |
| `social/instagram-portrait-1080x1350.png` | Instagram's tallest feed size — a square crops out of it without loss, and not the other way round. |
| `social/story-1080x1920.png` | A story or a reel. |
| `social/facebook-cover-1640x624.png` | A Facebook page cover, at twice its shown size. |
| `social/reddit-banner-*.png` | Reddit's community banner, desktop 1072×128 and mobile 1080×128. |
| `social/youtube-banner-2048x1152.png` | The channel banner. Everything that must survive is inside the 1235×338 centre every device shows. |
| `social/youtube-watermark-150.png` | The watermark YouTube overlays on a playing video. Transparent, so it is the mark and nothing else. |

## Where each one goes

| Platform | Profile | Header | Post |
| --- | --- | --- | --- |
| Facebook | `profile-square-512` | `facebook-cover-1640x624` | `square-1080`, `open-graph-1200x630` |
| Instagram | `profile-square-512` | — | `instagram-portrait-1080x1350`, `square-1080`, `story-1080x1920` |
| Reddit | `profile-square-256` | `reddit-banner-desktop-1072x128`, `reddit-banner-mobile-1080x128` | — |
| YouTube | `profile-square-800` | `youtube-banner-2048x1152` | `npm run promo:thumbs` — one per video |

One profile picture serves them all: it is one mark, and a name each would drift apart the
first time somebody edited only one.

It is a **square**, not a circle, even though every platform shows it as one. Drawing the
circle here put white in the corners — a screenshot paints white where nothing is drawn —
and YouTube's crop is a hair wider than the circle, so those corners showed as pale arcs
along the top edge. A square has no edge to reveal. Its ground is the mark's own violet, so
the tile's rounded corners meet it invisibly however tightly the crop lands.

The covers differ because the crops do — Facebook takes a wide strip and narrows it on a
phone, Reddit takes a thin one and lays the community's own icon and name over the left of
it. Both keep everything that matters in the middle for that reason, and nothing but ground
at the edges.

Reddit's community colours, from the palette: **base** `#4915d2` (violet), **key**
`#aa36fc` (plink), **pinned post** `#a67c2e` (brass).

YouTube crops its banner four ways — a TV shows the whole 2048×1152, a desktop a wide
strip, a phone the middle — so only the 1235×338 box at the centre is on every device. That
is a sixth of the picture, and a banner designed edge to edge loses its ends on three
devices out of four.

## Videos

`npm run promo:videos` renders the clips, playing the recorded piano and levelled to the
loudness a feed plays at. Two shapes come out of the same machinery:

| For | Command | What it is |
| --- | --- | --- |
| Instagram, a feed | `npm run promo:videos` | 1080×1080, the opening 20 seconds |
| YouTube | `npm run promo:videos -- --youtube` | 1920×1080, the whole piece |
| Thumbnails | `npm run promo:thumbs` | 1280×720, one per clip, named to match it |

A thumbnail belongs to a video, not to a channel: YouTube asks for one per upload, and the
same picture on fifty-five of them makes a channel read as a wall of identical tiles, which
is the one thing a thumbnail exists to prevent. So each names its own piece, from the same
list the clips are rendered from — a thumbnail can never be of a different piece than the
video under it.

Only CC0 pieces are eligible: the catalogue's CC-BY and CC-BY-SA scores carry obligations
that a feed strips, and share-alike travels with a video.

### What to write under them

The channel's About, in the app's own voice. It is fenced because it is meant to be
pasted, not read as markdown:

```text
Piano, one piece at a time.

Every clip here is played by Plinky itself — the notes falling, the keys lighting under
them, each finger in its own colour. The music is public domain. The piano is a real one:
the Salamander Grand Piano, recorded by Alexander Holm and shared under CC-BY 3.0.

Plinky is free piano practice in your browser. No account, nothing to install. Bring a
MIDI keyboard or use your computer keys, then play any score you like — or drill
sight-reading, rhythm, tempo and ear training. Every run is graded, and your scores stay
on your device.

Have a go: https://plinky.fun
```

And under each video, with the piece and composer filled in:

```text
{Piece} — {Composer}

Played by Plinky, free piano practice in your browser: https://plinky.fun

The score is public domain (CC0). The piano is the Salamander Grand Piano by Alexander
Holm, under CC-BY 3.0: https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html

The colours are fingers — thumb to little finger — worked out for the hand as it plays.
```

**The piano's credit goes on every video, not only the channel.** CC-BY asks for
attribution wherever the work travels, and a video carries the recordings with it: somebody
who finds one clip has met the recordings without ever seeing the About page. It costs two
lines and it is the licence's one condition.

## The mark

A full lockup on one rounded violet tile: three white keys with two black ones between
them, a violet plink falling onto the middle key down a glowing trail, and the word
**Plinky** set below in rounded letterforms. The plink is the only place that light violet
appears — spending it anywhere else would make it decoration rather than a signature.

**The mark carries the name, so nothing sets the name beside it.** A wordmark next to this
tile prints "Plinky" twice. Every sheet in the kit pairs it with the *tagline* — "Practise
piano in your browser" — which is the one thing the artwork does not already say.

**Never clip it with a border-radius.** The tile's rounded silhouette lives in the master's
alpha channel: it is scaled and composited, never cropped. A radius is a guess at the
artwork's own curve, and a guess even slightly tight leaves a sliver of ground showing all
the way round. Where the mark needs an edge against a violet ground it gets a paper plate
behind it, and the radius there is the plate's own.

`brand/plinky-mark.png` is written by `npm run mark` (`dev/key-mark.mjs`) from
`brand/source/plinky-mark.png`, the artwork as supplied — a flattened export with white
corner wedges and no alpha. `core/matte.ts` floods inward from the four corners across
near-white and stops at anything enclosed, which is why the keys and the wordmark survive
while the corners come out transparent.

The same command writes `brand/plinky-icon.png` from the keyed master — so the icon
inherits the silhouette the flood found rather than keying the same corners twice.
`core/iconMark.ts` reads the rows of white artwork as bands, takes the bottom one as the
word, repaints it in the tile's own ground sampled from each row's edges, and slides what
is left onto the tile's centre line. The word is found rather than assumed: where it sits
is a fact about one revision of one file, and a hard-coded band would go on erasing those
rows of a redrawn mark whatever they turned out to hold, while every gate stayed green.

`npm run mark -- --check` fails if either is missing or stale.

## The colours

Read `palette.png` — every entry says what its colour is *for*. Two rules matter more than
the hexes:

**The identity is violet, and it is the pressable colour.** Accent violet `#4915d2` carries
links, buttons and the cursor; the plink `#aa36fc` is the falling note in the mark and
nothing else; type is `#191545` and the ground is `#f9f8fc`. Brass `#a67c2e` is reserved
for what a player earned.

**Three colours are spoken for.** Green means the note you found, red the one you missed,
amber means caution and the top grade — and the share grid runs green through amber to red
across five bands. On the screen where colour is the information, a decorative green is a
lie. Never borrow them.

## The type

**Fredoka** for anything titular — a rounded sans, friendly at a glance and legible at a
thumbnail's size, which is the register Plinky wants. **Inter** for anything operable:
controls, tables, labels, numbers. Numbers that line up in a column are set tabular.

Fredoka covers Latin; the app pairs it with Comfortaa for Greek and Cyrillic. Chinese,
Japanese and Korean fall through to the platform's own rounded or UI face — the right
answer rather than a compromise, since no display face we can ship covers them well. The
sheets in this kit are never translated, so they embed the Latin subsets alone.

Both faces are under the SIL Open Font License 1.1. Anything published from this kit that
ships or embeds them carries that licence with it; a rendered picture of type does not.

## The voice

Plinky talks like a teacher who is glad you showed up. It invites, it never nags, and it
never counts consecutive days at anybody — the product has no streaks and never will.
`VOICE.md` in the repository root is the full contract; the two rules that catch most
mistakes are: say what the reader gets, not what the product does, and never promise
something the app cannot deliver in one tap.

## Using it

Every file here is the Plinky Authors' own work under AGPL-3.0-or-later, declared by the
`brand/**` entry in `REUSE.toml` — the master and the supplied source included.

Anything made from this kit is about Plinky, so it inherits Plinky's own claims: free, no
account, nothing to install, and a catalogue that is Creative Commons throughout with
every piece credited. Those are true. Do not add ones that are not — no leaderboards, no
"streak", no "practise every day or lose your progress".
