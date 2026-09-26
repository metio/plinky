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

export type Mask = Uint8Array;

export type MatteOptions = {
    // Near-white cut-off, for the default "flattened onto white" rule.
    near?: number;
    // Where the flood starts. Defaults to the four corners; artwork bled to one edge but
    // not another is why these can be given.
    seeds?: number[];
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
    { near = NEAR, seeds }: MatteOptions = {},
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
    const looksLikeBackground = (pixel: number) => {
        const at = pixel * 4;
        return (
            (rgba[at] as number) >= near &&
            (rgba[at + 1] as number) >= near &&
            (rgba[at + 2] as number) >= near
        );
    };
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
