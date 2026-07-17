// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Section looping: a bar range the player builds by clicking the score, drilled
// over and over. Ranges here are 1-based, as the player reads them off the staff.

// What a click on a bar means. The loop claims a click only once it is on; with it
// off the tap belongs to the caller, which sets the play position instead.
export type LoopClick =
    // The loop is off — the click was never the loop's to consume.
    | { kind: "bare"; bar: number }
    // The range, and the anchor the next click extends from (null once the range is
    // complete, so a third click starts a new selection rather than stretching this one).
    | { kind: "range"; from: number; to: number; anchor: number | null };

// A click on a bar, against the loop's state and any anchor already dropped. The
// first click of a selection drops the anchor as a one-bar loop; the next extends
// to the far end. The two clicks may come in either order on the staff, so the
// range is read from the pair rather than from which was clicked first.
export function loopClick({
    on,
    anchor,
    bar,
}: {
    on: boolean;
    anchor: number | null;
    bar: number;
}): LoopClick {
    if (!on) {
        return { kind: "bare", bar };
    }
    if (anchor === null) {
        return { kind: "range", from: bar, to: bar, anchor: bar };
    }
    return {
        kind: "range",
        from: Math.min(anchor, bar),
        to: Math.max(anchor, bar),
        anchor: null,
    };
}
