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

// Everything drawn BELOW an element, as one rectangle — the element's own box excluded.
//
// The exclusion is the whole point and is easy to lose: fold the element's box in and the
// question `mayDescend` asks becomes "does this child contain its own parent", which
// nothing can, so the crop silently stops descending and every frame is the container it
// started from. Taking the boxes as a list rather than walking a tree is what lets that
// be tested at all.
export function descendantBounds(boxes: readonly Box[]): Box | null {
    return boxes.reduce<Box | null>(
        (bounds, box) => (bounds === null ? box : union(bounds, box)),
        null,
    );
}

// Whether the crop may step from a box down into the single thing inside it.
//
// It may not if that would drop something drawn elsewhere — a popover hanging outside its
// trigger, a bar fixed to the viewport — because a frame that loses part of the picture
// compares the rest of it against a baseline that lost the same part, and the two agree
// forever.
//
// `drawn` is what is drawn BELOW `parent` (see descendantBounds), never `parent` itself.
export function mayDescend(parent: Box, child: Box, drawn: Box, min = MIN_CROP_PX): boolean {
    if (!holds(child, drawn)) {
        return false;
    }
    if (boxArea(child) >= boxArea(parent)) {
        return false;
    }
    return boxWidth(child) >= min && boxHeight(child) >= min;
}

// The story as a tree of boxes, which is all the descent needs to know about a DOM.
export type CropNode = {
    box: Box;
    // Whether the crop must stop here whatever is inside — an SVG boundary, an element
    // that paints its own ground or edge, one carrying text of its own. The caller
    // decides what counts; this only respects the answer.
    stops: boolean;
    // Drawn children, in document order. The caller filters out what is not drawn and
    // what an ancestor clips away.
    children: CropNode[];
};

const boxesBelow = (node: CropNode): Box[] =>
    node.children.flatMap((child) => [child.box, ...boxesBelow(child)]);

// The tightest node that is still a picture of the whole story.
//
// This lives here, away from the DOM, because the recursion is where the mistakes have
// been. Twice a version of it shipped that could not descend at all — once by folding the
// root's own box into the union, once by computing that union a single time and reusing
// it, which from the second step down asks whether a child contains its own parent. Both
// survived a green test suite, because a test that calls `mayDescend` with a union built
// by hand never builds the union the way the caller does. Taking the whole walk as a
// function means the walk itself is what gets tested.
export function tightestOf(node: CropNode, min = MIN_CROP_PX): CropNode {
    if (node.stops || node.children.length !== 1) {
        return node;
    }
    const only = node.children[0]!;
    // Recomputed per level, and always for the node being descended FROM.
    const below = descendantBounds(boxesBelow(node));
    if (below === null || !mayDescend(node.box, only.box, below, min)) {
        return node;
    }
    return tightestOf(only, min);
}
