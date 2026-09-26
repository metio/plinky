<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A proposed mark, not the shipped one

The app does not use anything in this folder. The shipped logo is the raster artwork in
`brand/plinky-mark.png`, `brand/plinky-icon.png` and `brand/plinky-keys.png`, and every icon,
social image and thumbnail is rendered from those.

These files are the designer's Optimised Option 3, drawn as vector in September 2026: three
white keys, two black, the plink falling down the middle key onto its strike point, on her
indigo `#3200af`. Every coordinate and hex was measured off her slide. They were in the build
for a fortnight and then set aside in favour of the artwork that shipped before them.

## Regenerating

```sh
npm run mark            # writes brand/proposed-mark/*.svg and brand/name-white.svg
npm run mark -- --check # fails if any of them is missing or differs
```

`dev/build-mark.mjs` is the one description all of them come from, and `--check` is a
blocking CI gate (`ci-mark-check`), so a change to the generator or to `core/wordmark.ts`
cannot leave these files claiming to be something they no longer are.

`brand/name-white.svg` is written by the same command but lives one directory up, because it
is type rather than logo: the outlined name that the social kit sets beside whichever mark
ships.

## The forms

| File | What it is |
| --- | --- |
| `symbol.svg` | The symbol on its circle. |
| `tile.svg` | The symbol on a rounded tile. |
| `tile-framed.svg` | The tile in a white frame an eleventh of its width, for an indigo ground. |
| `keys.svg` | The keys, the plink and its strike point with no ground at all. |
| `square.svg` | Full bleed, for anything that rounds or circles the corners itself. |
| `maskable.svg` | Full bleed with the drawing inside the middle 80%, for launchers that crop. |
| `badge.svg` | The name inside the circle, for places that show the mark without a caption. |
| `lockup-light.svg` | The tile beside the name, for a light ground. |
| `lockup-indigo.svg` | The same on indigo: the framed tile, the name in white. |
| `lockup-dark.svg` | The same on any other dark ground, without the frame. |
