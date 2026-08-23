// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finding the background an image was flattened onto.
//
// Artwork often arrives without transparency — exported once, over white, because that is
// what the tool did. The shape then carries its old background baked into the corners, and
// every use of it on any other colour shows a halo. Plinky's mark arrived exactly so: a
// rounded violet square with four white corner wedges and no alpha channel at all.
//
// The fix is not to crop to a radius. A radius is a guess about the artwork's own curve, and
// a guess that is slightly tight leaves a sliver of the old background showing all the way
// round — which is precisely the halo it was meant to remove.
//
// What works is asking which pixels are actually background, and the answer is: the ones that
// look like it AND are connected to the edge. Connectivity is the whole idea. The mark's
// piano keys and its wordmark are white too, and they are enclosed by violet, so a flood that
// starts at the corners never reaches them. Keying every white pixel would erase the keys.

// How close to the background colour a pixel must be to be swallowed. Generous, because the
// edge of a shape is antialiased against its background and those blend pixels are the halo.
const NEAR = 226;

// How far from a named background colour a pixel may sit and still be swallowed, summed
// across the three channels. A tile drawn with a gradient is not one flat colour, so this
// has to be loose enough to cross it and tight enough to stop at what is drawn on top.
const WITHIN = 150;

export type Mask = Uint8Array;

export type MatteOptions = {
    // Near-white cut-off, for the default "flattened onto white" rule.
    near?: number;
    // Where the flood starts. Defaults to the four corners; artwork bled to one edge but
    // not another is why these can be given.
    seeds?: number[];
    // A background colour to swallow instead of near-white, as [r, g, b].
    like?: readonly [number, number, number];
    // How far from `like` a pixel may sit, summed across the channels.
    within?: number;
};

// A flag per pixel: 1 where the pixel is background that should become transparent.
//
// `rgba` is the raw image, four bytes per pixel, row by row — the layout every canvas and
// image decoder produces. `seeds` are the pixels the flood starts from, and default to the
// four corners; artwork bled to one edge but not another is why they can be given.
export function flattenedBackground(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    { near = NEAR, seeds, like, within = WITHIN }: MatteOptions = {},
): Mask {
    const mask = new Uint8Array(Math.max(0, width * height));
    if (width <= 0 || height <= 0) {
        return mask;
    }
    // Two ways to say what the background is, and the flood is the same either way.
    //
    // By default it is anything near white, which is what artwork flattened for print
    // arrives on. `like` names a colour instead — for taking the mark off its own violet
    // tile, where the thing to remove is the saturated ground and the thing to keep is the
    // white the default rule would have swallowed.
    const isNearWhite = (at: number) =>
        (rgba[at] as number) >= near &&
        (rgba[at + 1] as number) >= near &&
        (rgba[at + 2] as number) >= near;
    // Manhattan distance: near enough for a flat ground, and it costs no square roots
    // across a million pixels.
    const isLike = (at: number) =>
        like !== undefined &&
        Math.abs((rgba[at] as number) - like[0]) +
            Math.abs((rgba[at + 1] as number) - like[1]) +
            Math.abs((rgba[at + 2] as number) - like[2]) <=
            within;
    // `like` REPLACES the near-white rule rather than joining it. Taking the mark off its
    // violet tile is a second pass over the same picture, and it must not swallow white —
    // the piano keys are white, and a rule that accepted both would flood straight through
    // the violet and eat them. The pass is seeded from where the first one finished, which
    // is how it reaches the tile at all.
    const looksLikeBackground = (pixel: number) =>
        like === undefined ? isNearWhite(pixel * 4) : isLike(pixel * 4);
    // An explicit stack rather than recursion: a full-width background is a million pixels
    // deep and would exhaust the call stack.
    // A COPY of the seeds: the stack is popped empty as the flood runs, and taking the
    // caller's array would hand it back drained — which silently does nothing at all the
    // second time the same seeds are used.
    const stack: number[] = seeds
        ? [...seeds]
        : [0, width - 1, (height - 1) * width, width * height - 1];
    const seen = new Uint8Array(width * height);
    while (stack.length > 0) {
        const pixel = stack.pop() as number;
        if (seen[pixel] === 1) {
            continue;
        }
        seen[pixel] = 1;
        if (!looksLikeBackground(pixel)) {
            continue;
        }
        mask[pixel] = 1;
        const x = pixel % width;
        const y = (pixel / width) | 0;
        if (x > 0) stack.push(pixel - 1);
        if (x < width - 1) stack.push(pixel + 1);
        if (y > 0) stack.push(pixel - width);
        if (y < height - 1) stack.push(pixel + width);
    }
    return mask;
}

// How much of the image the mask covers, 0..1 — a build step's sanity check. A mark whose
// background is suddenly most of the picture, or none of it, has changed in a way somebody
// should look at rather than ship.
export function maskedShare(mask: Mask): number {
    if (mask.length === 0) {
        return 0;
    }
    let flagged = 0;
    for (const flag of mask) {
        flagged += flag;
    }
    return flagged / mask.length;
}

// The pixels just INSIDE a mask — the first ring the flood did not take.
//
// A second pass needs these as its seeds. Seeding it with the mask itself does nothing at
// all: those pixels already failed the new rule, so the flood stops on the spot without
// ever expanding.
export function insideEdgeOf(mask: Mask, width: number, height: number): number[] {
    const seeds: number[] = [];
    for (let pixel = 0; pixel < mask.length; pixel++) {
        if (mask[pixel] !== 1) {
            continue;
        }
        const x = pixel % width;
        const y = (pixel / width) | 0;
        if (x > 0 && mask[pixel - 1] === 0) seeds.push(pixel - 1);
        if (x < width - 1 && mask[pixel + 1] === 0) seeds.push(pixel + 1);
        if (y > 0 && mask[pixel - width] === 0) seeds.push(pixel - width);
        if (y < height - 1 && mask[pixel + width] === 0) seeds.push(pixel + width);
    }
    return seeds;
}

// The mask, grown outward by `by` pixels.
//
// What this is for: where two grounds meet, the pixels between them are a blend of the two
// and match neither rule, so a flood leaves a hairline of them behind — the ghost of an
// edge that was supposed to be gone. It cannot be taken by loosening a rule, because a
// blend of white and violet sits about as far from that violet as the black keys do, and
// anything wide enough to catch the ring eats them. It can be taken by WHERE it is: the
// ring hugs the silhouette, and the artwork does not.
export function grownBy(mask: Mask, width: number, height: number, by: number): Mask {
    let current = mask;
    for (let step = 0; step < by; step++) {
        const next = Uint8Array.from(current);
        for (let pixel = 0; pixel < current.length; pixel++) {
            if (current[pixel] !== 1) {
                continue;
            }
            const x = pixel % width;
            const y = (pixel / width) | 0;
            if (x > 0) next[pixel - 1] = 1;
            if (x < width - 1) next[pixel + 1] = 1;
            if (y > 0) next[pixel - width] = 1;
            if (y < height - 1) next[pixel + width] = 1;
        }
        current = next;
    }
    return current;
}

// Everything above `above` removed, except a narrow band down the middle and whatever is
// near-white.
//
// A glow is drawn to blend into the ground it sits on. Take the ground away and it stops
// being a glow and becomes an opaque blob with an edge — which is what the falling note's
// halo turned into once the tile behind it was keyed out. There is no colour rule that
// separates a halo from the line it surrounds, because they are the same violet; there is
// a geometric one, because the line is narrow and centred and the halo is not.
//
// Near-white survives regardless, which is what keeps the note itself — a white bubble at
// the top of the fall — and the dots strung out beneath it.
export function narrowedAbove(
    mask: Mask,
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    { above, centreX, half, near = NEAR }: NarrowOptions,
): Mask {
    const out = Uint8Array.from(mask);
    for (let y = 0; y < Math.min(above, height); y++) {
        for (let x = 0; x < width; x++) {
            const pixel = y * width + x;
            if (out[pixel] === 1) {
                continue;
            }
            const at = pixel * 4;
            const isNearWhite =
                (rgba[at] as number) >= near &&
                (rgba[at + 1] as number) >= near &&
                (rgba[at + 2] as number) >= near;
            if (!isNearWhite && Math.abs(x - centreX) > half) {
                out[pixel] = 1;
            }
        }
    }
    return out;
}

export type NarrowOptions = {
    // The row the artwork proper begins at; nothing below it is touched.
    above: number;
    // The middle of the band that survives.
    centreX: number;
    // How far either side of centreX to keep.
    half: number;
    near?: number;
};
