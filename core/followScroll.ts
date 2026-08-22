// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a growing panel should keep its newest content in view.
//
// While you record, the sketch of what you are playing grows downward, and the notes
// you just played are the ones at the bottom. Left alone, the panel keeps its scroll
// position and your own playing disappears below the fold.
//
// Following blindly would be worse than not following: someone who scrolls back to look
// at an earlier bar must be allowed to stay there. So the panel follows only while the
// reader is already at the end of it — the same rule a log tailer uses. Scroll up and it
// lets go; scroll back down and it takes hold again, with no control to find and no
// state to remember.

// How far from the bottom still counts as "at the end", in pixels. A rendered staff
// rarely lands on an exact boundary — a partial system, a border, a rounded height —
// and a reader who is a few pixels short has not scrolled away from anything.
export const FOLLOW_SLACK_PX = 32;

export type ScrollBox = {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
};

// Whether the box is scrolled to its end (within the slack). A box with nothing to
// scroll is trivially at its end, so a short sketch follows from the first note.
export function atEnd(box: ScrollBox, slack = FOLLOW_SLACK_PX): boolean {
    return box.scrollHeight - box.scrollTop - box.clientHeight <= slack;
}


// Whether a panel the reader has just chosen is somewhere they can see.
//
// The glossary stacks into one column on a phone: a list of marks the height of the
// screen, with the chosen mark's explanation under it. Tapping a mark changes something
// the reader may not be looking at, so the explanation is brought to them — but only when
// it is genuinely out of sight, since scrolling a panel that is already in view yanks the
// page for no reason.
//
// It takes BOTH edges, because a panel's top being above the fold says nothing about
// whether the panel can be seen. On a wide screen the list and the detail sit side by side
// and the detail is always visible — but its top goes negative the moment the reader
// scrolls at all, and asking about the top alone therefore yanked the page on every choice
// they made after scrolling. Off screen means entirely off: the whole panel above the
// viewport, or the whole panel below it.
export function outOfView(top: number, bottom: number, viewportHeight: number): boolean {
    return bottom <= 0 || top >= viewportHeight;
}
