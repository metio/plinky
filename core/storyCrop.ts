// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which box a story screenshot should be cropped to.
//
// The comparison allowance is a fraction of the frame, so a shot of the whole viewport
// spends it on empty page and a small control could change beyond recognition inside its
// own tolerance. Cropping to the story fixes that — but a crop is only sound while it
// still holds everything the story drew, and while it stops at the thing being looked at
// rather than at some shape inside it.
//
// The rules live here, over plain rectangles, because getting them wrong is silent: a
// frame cropped to an icon's outline is ~100% ink and passes every measure of "tight",
// while asserting nothing about the button around it.

export type Box = { left: number; top: number; right: number; bottom: number };

export function union(one: Box, other: Box): Box {
    return {
        left: Math.min(one.left, other.left),
        top: Math.min(one.top, other.top),
        right: Math.max(one.right, other.right),
        bottom: Math.max(one.bottom, other.bottom),
    };
}

// Whether a frame holds every pixel of what was drawn.
//
// Half a pixel of slack, because a rect measured from layout and a rect measured from a
// child's border box disagree in the last bit often enough to matter.
const SLACK = 0.5;

export function holds(frame: Box, drawn: Box): boolean {
    return (
        drawn.left >= frame.left - SLACK &&
        drawn.top >= frame.top - SLACK &&
        drawn.right <= frame.right + SLACK &&
        drawn.bottom <= frame.bottom + SLACK
    );
}

// Everything drawn below an element, as one rectangle — the element's own box excluded.
//
// The exclusion is the point: fold the element's box in and "did anything escape this
// container" can never answer yes, because the union always sits inside itself.
export function descendantBounds(boxes: readonly Box[]): Box | null {
    return boxes.reduce<Box | null>(
        (bounds, box) => (bounds === null ? box : union(bounds, box)),
        null,
    );
}
