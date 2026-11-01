// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/brandGroup.mjs, which stays plain JavaScript because the brand and icon
// builds run it under bare Node. Nothing regenerates this file — an export added there
// and not declared here compiles locally and fails `npm run typecheck`.

// A picture and the proportions it was drawn in: `aspect` is width over height, so a
// layout names a height and the width follows.
export type Art = { src: string; aspect: number };

// Artwork as a data URI, with its aspect read out of the bytes — an SVG's viewBox or a
// PNG's IHDR. Anything it cannot measure is treated as square.
export function markImage(bytes: Buffer, type?: string): Art;

// An `<img>` at the given height, its width taken from the artwork's own aspect.
export function picture(art: Art, height: number): string;

// The mark on a plate of `paper`, for a ground its own edge would vanish into. Returns a
// function of the plate's outer HEIGHT; the plate widens for artwork wider than it is tall.
export function framedMark(art: Art, paper: string): (size: number) => string;

// The mark, the name, a tagline and a small line, set as one group — beside each other
// when `wide`, stacked under the mark otherwise.
export function markGroup(options: {
    mark: (size: number) => string;
    name: Art;
    size: number;
    wide?: boolean;
    ink: string;
    display: string;
    ui: string;
    tagline: string;
    line: string;
    title?: number;
    small?: number;
    measure?: number;
    lineMeasure?: number;
}): string;
