// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The bouquet: the bar under the header, and the petals of the greeting's flower. Both
// set five colours side by side, and both are decoration — these are the colours that
// mean nothing anywhere in the app, which is what lets them be spent on furniture.
//
// One list, because the two surfaces draw the same bouquet and a colour that moved in one
// of them would quietly leave the other with a petal of some other flower. The entries are
// whole class names rather than token names: Tailwind collects classes by reading them in
// the source, so a name assembled at runtime is a class it never compiles.
//
// What is asked of them is that they stay apart. A petal within a hair of its neighbour
// turns five petals into four and the bar into four bands, and nothing on screen says so —
// dev/bouquetDistinct.test.mts measures every pair, in every palette and shade.

// The bar under the header. It takes `spark`, which follows the palette, so the bouquet
// is a different five in each one.
export const BOUQUET = [
    "bg-spark",
    "bg-bloom-leaf",
    "bg-bloom-sky",
    "bg-tinkle",
    "bg-bloom-violet",
] as const;

// The flower's petals. The sun stands where the bar takes the reward colour.
export const PETALS = [
    "bg-bloom-sun",
    "bg-bloom-leaf",
    "bg-bloom-sky",
    "bg-tinkle",
    "bg-bloom-violet",
] as const;
