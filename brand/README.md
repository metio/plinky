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
| `social/*.png` | Open Graph 1200×630, square 1080, story 1080×1920. |

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
