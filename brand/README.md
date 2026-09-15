<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# The Plinky kit

Everything here is generated. The mark is vector, in `mark/`, written by `npm run mark`;
every picture in the rest of the kit is rendered from those files and from `app/app.css` by
`npm run brand`, so the colours in a poster are the colours in the app by construction —
there is no second copy to keep in step. Edit the app or the mark's generator; rerun the
scripts. `npm run brand` reads resolved token values out of the built stylesheet, so a build
has to exist first: `npm run build:single` (or `ci-build`), then `npm run brand`.

| File | What it is |
| --- | --- |
| `mark/tile.svg` | The symbol on a rounded tile: the app icon, the favicon, the app header and the per-piece link cards. |
| `mark/tile-framed.svg` | The tile in a thick white frame, for an indigo ground the tile would otherwise vanish into: every social image, the YouTube watermark. |
| `mark/keys.svg` | The keys, the falling plink and its strike point with no ground at all, for a dark stage: the video thumbnails. |
| `mark/symbol.svg` | The symbol on its circle, for a platform that shows a round profile picture and accepts a transparent one. Nothing else uses it. |
| `mark/square.svg` | The symbol on a full-bleed square, for anything that rounds or circles the corners itself — Apple's touch icon, a profile picture. Inside a circle it is exactly the symbol. |
| `mark/maskable.svg` | Full bleed with the drawing inside the middle 80%, for Android launchers that crop an icon to their own shape. |
| `mark/badge.svg` | The name inside the circle, under the symbol, for places that show the mark without a caption. |
| `mark/lockup-light.svg` | The tile beside the name, for a light ground. |
| `mark/lockup-indigo.svg` | The same for an indigo ground: the framed tile, and the name in white with a little more spacing. |
| `mark/lockup-dark.svg` | The same for any other dark ground, without the frame. |
| `mark/name-white.svg` | The name alone in white, which the social images set beside or under the framed tile. |
| `icon/plinky-*.png` | The tile at 32 · 64 · 180 · 192 · 512 · 1024, transparent outside its own silhouette. |
| `icon/badge-512.png` | The badge, transparent outside its circle. |
| `icon/lockup-paper.png` | The lockup over the tagline on paper, 960×320 at 2×, for light surfaces. |
| `icon/lockup-indigo.png` | The same on indigo. |
| `palette.png` | Every colour with its role, as a sheet. |
| `palette.json` | The same, for tools. Hex plus the token each comes from. |
| `type.png` | The two faces, set as the app sets them. |
| `social/profile-square-*.png` | The profile picture, at 256 · 512 · 800: the symbol alone, from the full-bleed square. |
| `social/open-graph-1200x630.png` | What a shared link unfurls as. |
| `social/square-1080.png` | A square post. |
| `social/instagram-portrait-1080x1350.png` | Instagram's tallest feed size — a square crops out of it without loss, and not the other way round. |
| `social/story-1080x1920.png` | A story or a reel. |
| `social/facebook-cover-1640x624.png` | A Facebook page cover, at twice its shown size. |
| `social/reddit-banner-*.png` | Reddit's community banner, desktop 1072×128 and mobile 1080×128. |
| `social/github-social-1280x640.png` | A repository's social preview: what GitHub, Slack and a chat client unfurl for a link to the code. |
| `social/youtube-banner-2048x1152.png` | The channel banner. Everything that must survive is inside the 1235×338 centre every device shows. |
| `social/youtube-watermark-150.png` | The watermark YouTube overlays on a playing video. Transparent, so it is the framed tile and nothing else. |

## Where each one goes

| Platform | Profile | Header | Post |
| --- | --- | --- | --- |
| Facebook | `profile-square-512` | `facebook-cover-1640x624` | `square-1080`, `open-graph-1200x630` |
| Instagram | `profile-square-512` | — | `instagram-portrait-1080x1350`, `square-1080`, `story-1080x1920` |
| Reddit | `profile-square-256` | `reddit-banner-desktop-1072x128`, `reddit-banner-mobile-1080x128` | — |
| GitHub | — | `github-social-1280x640` (Settings → Social preview) | — |
| YouTube | `profile-square-800` | `youtube-banner-2048x1152` | `npm run promo:thumbs` — one per video |

One profile picture serves them all: it is one mark, and a name each would drift apart the
first time somebody edited only one.

The profile picture is the symbol alone, as the designer recommended for an avatar: it is
shown at about 56px beside a comment, where a name would be a smear. It is a **square**, not
a circle, even though every platform shows it as one. A drawn circle leaves its corners
transparent or white, and YouTube's crop is a hair wider than the circle, so those corners
showed as pale arcs along the top edge. Inside any circular crop the square is exactly the
symbol, and beyond its edge there is only more of the same indigo.

Every picture on indigo sets the same group: the framed tile, large, then the name, then
the tagline and its small line. The wide pictures set the words beside the tile; the square
and tall ones set them under it. The GitHub preview sets the same group on the designer's
navy rather than indigo. The covers
differ because the crops do — Facebook takes a wide strip and narrows it on a phone, Reddit
takes a thin one and lays the community's own icon and name over the left of it. Both keep
everything that matters in the middle for that reason, and nothing but ground at the edges.

Reddit's community colours come from the palette: **base** is indigo, **key** is plink,
**pinned post** is forget-me-not. `palette.json` has the hexes.

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

The symbol is three white keys with two black ones between them on an indigo circle, and a
plink falling down the middle key onto its strike point, which sits at the centre of the
key. It is the designer's own Optimised Option 3 in her colours — the indigo ground
`#3200af`, a forget-me-not glow behind the keys, a violet trail and strike point — and every
coordinate and hex in it was measured off her slide. It is drawn flat, with one light
direction, and nothing is added to it for any of its forms: the tile, the square, the
maskable icon, the badge and the lockups only place the same drawing.

**On an indigo ground the tile stands in a thick white frame.** Without it the tile has no
edge against a ground of nearly its own colour, and the symbol reads as keys floating on
indigo. The frame is an eleventh of the tile's width on every side, with its corners the
tile's grown by that much, and it is for that ground only; on paper, black or ink the tile
is its own edge. **On a dark stage the keys go alone**, with no tile or circle behind them:
the video thumbnails set `keys.svg`, whose white keys carry their own edge against the
dark. **The circle is for round profile pictures only**, and even there the kit hands out
the full-bleed square, which every platform crops to the same circle.

**The name is Fredoka at weight 600**, the face the app already ships, set with no extra
spacing on a light ground and with 0.05em of letter-spacing on indigo or any dark ground,
where light type needs more air to stay open. On paper it is ink `#1c1640`; on indigo and
dark grounds it is white. In the lockups it is converted to outlines, so no file depends on
a font loading. `core/wordmark.ts` holds the spacing for every place that sets the name live
— the app header, the promo thumbnails and an exported video.

**The tile keeps its own silhouette.** The rounded corners of `tile.svg` are the drawing's,
so it is scaled and never clipped with a border-radius, which is a guess at the curve and
one slightly tight leaves a sliver of ground showing all the way round. Where a platform
rounds the corners itself, use `square.svg`.

`npm run mark` (`dev/build-mark.mjs`) writes every file in `mark/`. It takes the name's
outlines from the variable Fredoka in `node_modules`, instanced at weight 600 with the
face's own kerning. `npm run mark -- --check` fails if a file there is missing or differs
from what the script writes, which is the gate that keeps a hand edit or a font update from
reaching the icons unannounced.

## The colours

Read `palette.png` — every entry says what its colour is *for*. Two rules matter more than
the hexes:

**The identity is indigo, and it is the pressable colour.** Indigo carries links, buttons
and the cursor; the plink is the falling note of the loader and nothing else; the name
beside the mark has its own ink; forget-me-not is reserved for what a player earned. The
grounds are the paper white of sheet music and a cooled grey for the lines.

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
ships or embeds them carries that licence with it; a rendered picture of type, and the
outlined name in the mark, do not.

## The voice

Plinky talks like a teacher who is glad you showed up. It invites, it never nags, and it
never counts consecutive days at anybody — the product has no streaks and never will.
`VOICE.md` in the repository root is the full contract; the two rules that catch most
mistakes are: say what the reader gets, not what the product does, and never promise
something the app cannot deliver in one tap.

## Using it

Every file here is the Plinky Authors' own work under AGPL-3.0-or-later, declared by the
`brand/**` entry in `REUSE.toml`; the SVGs in `mark/` also carry it inline.

Anything made from this kit is about Plinky, so it inherits Plinky's own claims: free, no
account, nothing to install, and a catalogue that is Creative Commons throughout with
every piece credited. Those are true. Do not add ones that are not — no leaderboards, no
"streak", no "practise every day or lose your progress".
