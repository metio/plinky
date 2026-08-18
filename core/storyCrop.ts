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

export const boxArea = (box: Box): number =>
    Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);

export const boxWidth = (box: Box): number => box.right - box.left;
export const boxHeight = (box: Box): number => box.bottom - box.top;

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

// The smallest a crop may get. Below this the frame is an icon's outline rather than the
// control drawn around it — and an outline is what every one of these components has in
// common, so a baseline of one asserts nothing about the component it came from.
export const MIN_CROP_PX = 24;

// Whether the crop may step from a box down into the single thing inside it.
//
// It may not if that would drop something drawn elsewhere — a popover hanging outside its
// trigger, a bar fixed to the viewport — because a frame that loses part of the picture
// compares the rest of it against a baseline that lost the same part, and the two agree
// forever.
export function mayDescend(parent: Box, child: Box, drawn: Box, min = MIN_CROP_PX): boolean {
    if (!holds(child, drawn)) {
        return false;
    }
    if (boxArea(child) >= boxArea(parent)) {
        return false;
    }
    return boxWidth(child) >= min && boxHeight(child) >= min;
}
