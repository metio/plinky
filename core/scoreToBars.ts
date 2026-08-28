// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SEMITONE } from "./notes";
import { gapTracker, scoreClock, TIMED_NODES } from "./scoreTiming";
import type { XmlCodec } from "./xml";
// Turns a piece's MusicXML into per-bar chord positions for one hand, so a passage
// can be fingered (or reproduced by ear). Each bar is a list of positions in play
// order; each position is the MIDI pitches sounding together — a single note, or a
// chord. Reads one hand's staff (treble for the right, bass for the left), the way a
// pianist reads each hand separately.

export type Bar = number[][];
// 1 = treble (right hand), 2 = bass (left hand) — the conventional grand-staff split.
export type Staff = 1 | 2;

export function staffFor(hand: "left" | "right"): Staff {
    return hand === "right" ? 1 : 2;
}

function midiOf(note: Element): number | null {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (!pitch) {
        return null;
    }
    const step = pitch.getElementsByTagName("step")[0]?.textContent ?? "";
    const octaveText = pitch.getElementsByTagName("octave")[0]?.textContent ?? "";
    if (!(step in SEMITONE) || octaveText === "") {
        return null;
    }
    const alter = Number(pitch.getElementsByTagName("alter")[0]?.textContent ?? "0");
    const midi = (Number(octaveText) + 1) * 12 + SEMITONE[step]! + alter;
    // A non-numeric <octave> or <alter> yields NaN, which would slip past the null
    // check and place a phantom position; treat it as an unreadable note.
    return Number.isFinite(midi) ? midi : null;
}

// Parse the first part's measures into bars of positions for the given staff, alongside
// how long the hand has before each position sounds. A note marked <chord/> joins the
// position before it; rests and the other staff are skipped as positions but still pass
// time, because a rest is time the hand can move in. Returns empty for unreadable XML, so
// callers can fall back gracefully.
export function scoreToTimedBars(
    codec: XmlCodec,
    xml: string,
    staff: Staff,
): { bars: Bar[]; gaps: number[][] } {
    const doc = codec.parse(xml);
    const part = doc?.getElementsByTagName("part")[0];
    if (!doc || !part) {
        return { bars: [], gaps: [] };
    }
    const bars: Bar[] = [];
    const gaps: number[][] = [];
    // One clock and one tracker for the whole part: divisions, tempo and the hand's own
    // waiting all run across bar lines.
    const clock = scoreClock();
    const timing = gapTracker();
    for (const measure of Array.from(part.getElementsByTagName("measure"))) {
        const positions: number[][] = [];
        const barGaps: number[] = [];
        for (const node of Array.from(measure.querySelectorAll(TIMED_NODES))) {
            const seconds = clock.read(node);
            if (node.tagName !== "note") {
                continue;
            }
            const noteStaff = Number(node.getElementsByTagName("staff")[0]?.textContent ?? "1");
            const midi = node.getElementsByTagName("rest").length > 0 ? null : midiOf(node);
            if (noteStaff !== staff || midi === null) {
                timing.skip(seconds);
                continue;
            }
            if (node.getElementsByTagName("chord").length > 0 && positions.length > 0) {
                positions[positions.length - 1]!.push(midi);
                continue;
            }
            barGaps.push(timing.start(seconds));
            positions.push([midi]);
        }
        bars.push(positions);
        gaps.push(barGaps);
    }
    return { bars, gaps };
}

export function scoreToBars(codec: XmlCodec, xml: string, staff: Staff): Bar[] {
    return scoreToTimedBars(codec, xml, staff).bars;
}

// The positions of a window of bars, flattened in play order — what the fingering or
// ear drill works on. Clamps the range to the available bars.
export function windowPositions(bars: Bar[], start: number, size: number): number[][] {
    return bars.slice(Math.max(0, start), Math.max(0, start) + size).flat();
}

// The window's gaps, flattened the same way and so parallel to windowPositions. The first
// gap in a window is the wait since the position before the window, which is the wrong
// question here — the hand arrives at a window already in place — so it reads as no time
// at all, which charges that one movement in full. That is the safe direction.
export function windowGaps(gaps: number[][], start: number, size: number): number[] {
    return gaps.slice(Math.max(0, start), Math.max(0, start) + size).flat();
}

// Where a flattened window position sits in the score: its absolute bar and its index
// within that bar. Parallel to windowPositions, so saved fingerings can be keyed by
// score position and survive the window sliding.
export type Cell = { bar: number; pos: number };

export function windowCells(bars: Bar[], start: number, size: number): Cell[] {
    const from = Math.max(0, start);
    const cells: Cell[] = [];
    for (let bar = from; bar < Math.min(from + size, bars.length); bar++) {
        for (let pos = 0; pos < bars[bar]!.length; pos++) {
            cells.push({ bar, pos });
        }
    }
    return cells;
}
