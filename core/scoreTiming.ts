// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long a note lasts, and how long the hand has before the next one.
//
// Three things decide a note's length and they arrive separately in a MusicXML document:
// <divisions> says how many ticks make a beat, <sound tempo="…"> how many beats make a
// minute, and the note's own <duration> is in ticks. Both of the first two can change
// partway through a score, so whatever walks the notes has to see all three in document
// order — which is why this is a reader a walk feeds, rather than a function over a
// document.
//
// Time is what separates a reachable leap from a hazard, so both the grader and the
// fingering trainer need it, and they group notes into positions differently. What they
// share is the arithmetic, and it lives here once.

// Everything a timed walk has to see, in document order.
export const TIMED_NODES = "divisions, sound, note";

// A score that states no tempo is read at a moderate one rather than assumed still.
export const DEFAULT_TEMPO = 100;

export type ScoreClock = {
    // Feed every node matching TIMED_NODES. Returns the seconds it occupies: zero for the
    // <divisions> and <sound> elements themselves, and zero for a chord member or a grace
    // note, which sound with what came before them and take no time of their own.
    read(node: Element): number;
};

export function scoreClock(): ScoreClock {
    let divisions = 1;
    let tempo = 0;
    return {
        read(node: Element): number {
            if (node.tagName === "divisions") {
                const value = Number(node.textContent ?? "");
                if (Number.isFinite(value) && value > 0) {
                    divisions = value;
                }
                return 0;
            }
            if (node.tagName === "sound") {
                const value = Number(node.getAttribute("tempo") ?? "");
                if (Number.isFinite(value) && value > 0 && tempo === 0) {
                    tempo = value;
                }
                return 0;
            }
            if (node.querySelector("chord") || node.querySelector("grace")) {
                return 0;
            }
            const ticks = Number(node.querySelector("duration")?.textContent ?? "");
            if (!Number.isFinite(ticks) || ticks <= 0 || divisions <= 0) {
                return 0;
            }
            return ((ticks / divisions) * 60) / (tempo > 0 ? tempo : DEFAULT_TEMPO);
        },
    };
}

export type GapTracker = {
    // Time passed without a position starting: a rest, or a note belonging to another
    // staff. The hand is free to travel through it.
    skip(seconds: number): void;
    // A position starts, lasting `seconds`. Returns how long the hand had since the
    // previous position began — the previous one's own length plus anything skipped since.
    start(seconds: number): number;
};

// One per hand: each hand's clock is its own, since a hand is only waiting on the notes
// it has to play.
export function gapTracker(): GapTracker {
    let held = 0;
    let skipped = 0;
    return {
        skip(seconds: number): void {
            skipped += seconds;
        },
        start(seconds: number): number {
            const gap = held + skipped;
            held = seconds;
            skipped = 0;
            return gap;
        },
    };
}
