<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# The Plinky kit

Everything here is generated. `npm run brand` rebuilds it from `app/app.css` and
`public/icon.svg`, so the colours in a poster are the colours in the app by construction —
there is no second copy to keep in step. Edit the app; rerun the script.

| File | What it is |
| --- | --- |
| `icon/plinky.svg` | The mark. Prefer it wherever vectors are accepted. |
| `icon/plinky-*.png` | The mark at 32 · 64 · 180 · 192 · 512 · 1024. |
| `icon/lockup-paper.png` | Mark and wordmark on paper, for light surfaces. |
| `icon/lockup-ink-blue.png` | The same on ink blue, for dark ones. |
| `palette.png` | Every colour with its role, as a sheet. |
| `palette.json` | The same, for tools. Hex plus the token each comes from. |
| `type.png` | The two faces, set as the app sets them. |
| `social/profile-square-*.png` | The profile picture, at 256 · 512 · 800. A full-bleed square; every platform crops it to a circle itself. |
| `social/open-graph-1200x630.png` | What a shared link unfurls as. |
| `social/square-1080.png` | A square post. |
| `social/instagram-portrait-1080x1350.png` | Instagram's tallest feed size — a square crops out of it without loss, and not the other way round. |
| `social/story-1080x1920.png` | A story or a reel. |
| `social/facebook-cover-1640x624.png` | A Facebook page cover, at twice its shown size. |
| `social/reddit-banner-*.png` | Reddit's community banner, desktop and mobile. |
| `social/youtube-banner-2048x1152.png` | The channel banner. Everything that must survive is inside the 1235×338 centre every device shows. |
| `social/youtube-thumbnail-1280x720.png` | A video thumbnail, with no per-video text to edit. |

## Where each one goes

| Platform | Profile | Header | Post |
| --- | --- | --- | --- |
| Facebook | `profile-square-512` | `facebook-cover-1640x624` | `square-1080`, `open-graph-1200x630` |
| Instagram | `profile-square-512` | — | `instagram-portrait-1080x1350`, `square-1080`, `story-1080x1920` |
| Reddit | `profile-square-256` | `reddit-banner-desktop-1072x128`, `reddit-banner-mobile-1080x128` | — |
| YouTube | `profile-square-800` | `youtube-banner-2048x1152` | `youtube-thumbnail-1280x720` |

One profile picture serves them all: it is one mark, and a name each would drift apart the
first time somebody edited only one.

It is a **square**, not a circle, even though every platform shows it as one. Drawing the
circle here put white in the corners — a screenshot paints white where nothing is drawn —
and YouTube's crop is a hair wider than the circle, so those corners showed as pale arcs
along the top edge. A square has no edge to reveal, and the letter sits well inside the
inscribed circle, so nothing is ever clipped.

The letter is placed by its centre of **gravity**, not its bounding box. A capital P
carries its mass in the stem and the bowl and leaves a void at the lower right, so a
box-centred P reads as sitting high and left: measured on the 800px render, its ink sat
1.5% left and 4.2% above the middle. It is nudged back by exactly that, which is the only
kind of centred anybody sees. The covers differ because the crops do —
Facebook takes a wide strip and narrows it on a phone, Reddit takes a thin one and lays the
community's own icon and name over the left of it. Both keep everything that matters in the
middle for that reason, and nothing but ground at the edges.

Reddit's community colours, from the palette: **base** `#2b4374` (ink blue), **key**
`#d81b7a` (plink), **pinned post** `#a67c2e` (brass).

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

Only CC0 pieces are eligible: the catalogue's CC-BY and CC-BY-SA scores carry obligations
that a feed strips, and share-alike travels with a video.

## The mark

The capital **P** of Literata — the face every title in the app is set in, and the letter
the name begins with — with the counter of its bowl inked pink. That pink is the plink, and
it is the only pink in Plinky: in the counter of the mark, and on the i of the wordmark.
Spending it anywhere else would make it decoration rather than a signature.

The outline is a derivative of Literata (SIL Open Font License 1.1) at weight 700, optical
size 24. The optical size is the whole tuning: it is where the counter is fullest and
roundest while the serifs are still sturdy enough to hold at a favicon's size. Below it the
counter narrows to a sliver; above 40 the strokes thin and the bowl starts to part from the
stem.

The mark comes two ways. On a tile — ink blue, paper letter — it is the app icon, and the
letter sits inside the middle 80% of the square so a launcher can round or crop it without
biting in. On nothing, as `public/favicon.svg`, it is the browser tab's: the letter alone,
ink blue on a light browser and paper on a dark one, because a tab is the browser's
furniture and a tile there only wedges a coloured box between the mark and the chrome.

## The colours

Read `palette.png` — every entry says what its colour is *for*. Two rules matter more than
the hexes:

**Warmth comes from the ground and the type, never from the accent.** Ivory paper, ink,
brass on the things a player earned. The accent is a deep ink blue and stays cool.

**Three colours are spoken for.** Green means the note you found, red the one you missed,
amber means caution and the top grade — and the share grid runs green through amber to red
across five bands. On the screen where colour is the information, a decorative green is a
lie. Never borrow them.

## The type

Literata for anything titular — it is the genre of type children learn to read from, which
is exactly the register Plinky wants. Inter for anything operable: controls, tables,
labels, numbers. Numbers that line up in a column are set tabular.

Chinese, Japanese and Korean fall through to the system serif. That is the right answer
rather than a compromise: no display face we can ship covers them well.

## The voice

Plinky talks like a teacher who is glad you showed up. It invites, it never nags, and it
never counts consecutive days at anybody — the product has no streaks and never will.
`VOICE.md` in the repository root is the full contract; the two rules that catch most
mistakes are: say what the reader gets, not what the product does, and never promise
something the app cannot deliver in one tap.

## Using it

Anything made from this kit is about Plinky, so it inherits Plinky's own claims: free, no
account, nothing to install, and a catalogue that is Creative Commons throughout with
every piece credited. Those are true. Do not add ones that are not — no leaderboards, no
"streak", no "practise every day or lose your progress".
