// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pure layout of the exported video's scene: where each piano key sits and
// what the credit line says. The painter applies these to a canvas; keeping the
// geometry and wording here keeps them testable and the painter thin.

import type { Attribution } from "./attribution";
import { keyLane } from "./keyboardGeometry";
import { maxOf, minOf } from "./stats";

// Black keys sit above the gap after these white-key positions within an
// octave (C, D, F, G, A — no black key after E and B).

export type SceneKey = {
    pitch: number;
    // Horizontal placement in 0..1 of the keyboard's width.
    x: number;
    width: number;
    black: boolean;
};

// Snap a pitch range outward to whole octaves (C to B) so the keyboard always
// reads as a piano, then keep it at least two octaves wide so a one-note take
// doesn't render three giant keys.
export function sceneRange(pitches: number[]): { from: number; to: number } {
    const lowest = minOf(pitches, 60);
    const highest = maxOf(pitches, 60);
    let from = lowest - (lowest % 12);
    let to = highest + (11 - (highest % 12));
    while (to - from < 23) {
        from = Math.max(0, from - 12);
        to = to - from < 23 ? to + 12 : to;
    }
    return { from, to };
}

// The keys of [from..to] laid across 0..1, from the app's own keyboard geometry.
//
// The same `keyLane` the on-screen keyboard and the practice highway are drawn from, in
// the units a painter wants rather than the percentages CSS wants. Two implementations of
// piano proportions was one too many: they agreed by coincidence, and a change to the
// instrument on screen would silently have stopped matching the instrument in the export.
//
// Whites first and blacks after, because the painter draws in order and a black key has to
// land on top of the whites it straddles.
export function sceneKeys(from: number, to: number): SceneKey[] {
    const keys: SceneKey[] = [];
    for (const black of [false, true]) {
        for (let pitch = from; pitch <= to; pitch++) {
            const lane = keyLane(pitch, from, to);
            if (!lane || lane.white === black) {
                continue;
            }
            keys.push({
                pitch,
                x: lane.leftPct / 100,
                width: lane.widthPct / 100,
                black,
            });
        }
    }
    return keys;
}

// A note in flight on the notes-highway video: its key's lane (x/width in 0..1,
// from sceneKeys) and where its ends sit as fractions of the look-ahead window —
// 0 at the strike line (the keys, "now"), 1 at the far edge (windowMs ahead).
// `onsetFrac` is the leading edge that lands first (the note's start), `endFrac`
// the trailing edge (start + duration), so a longer note is a taller block. A
// sounding note has onsetFrac < 0 (already past the line); the painter clamps to
// the drawable region.
export type HighwayBlock = {
    pitch: number;
    // When the note sounds, on whatever clock the caller handed in. Carried so a painter
    // that keeps its blocks between frames — the DOM one, whose blocks are elements that
    // move — can tell one from another across a shift of the origin. A canvas painter,
    // which redraws everything every frame, has no use for it.
    startMs: number;
    // The finger the note is played with, where the performance knows it.
    finger?: number;
    // The hand that plays it, where the score says. Carried alongside the finger because
    // the two pictures colour by different things — practice by hand, an export by
    // whichever the person making it chose — and one block model has to serve both.
    hand?: "left" | "right";
    x: number;
    width: number;
    onsetFrac: number;
    endFrac: number;
};

// The notes visible on the highway at time `tMs` (the notes' own clock): those
// whose block overlaps the window [line, windowMs ahead] — not yet fully past the
// keys (endFrac > 0) and already descending into view (onsetFrac < 1). Time-based,
// so blocks fall and are sized by real duration, unlike the position-indexed
// on-screen highway.
export function highwayBlocks(
    notes: readonly {
        pitch: number;
        startMs: number;
        durationMs: number;
        finger?: number;
        hand?: "left" | "right";
    }[],
    keys: readonly SceneKey[],
    tMs: number,
    windowMs: number,
): HighwayBlock[] {
    const lane = new Map(keys.map((key) => [key.pitch, key]));
    const blocks: HighwayBlock[] = [];
    for (const note of notes) {
        const key = lane.get(note.pitch);
        if (!key) {
            continue;
        }
        const onsetFrac = (note.startMs - tMs) / windowMs;
        const endFrac = (note.startMs + note.durationMs - tMs) / windowMs;
        if (endFrac <= 0 || onsetFrac >= 1) {
            continue;
        }
        blocks.push({
            pitch: note.pitch,
            startMs: note.startMs,
            finger: note.finger,
            hand: note.hand,
            x: key.x,
            width: key.width,
            onsetFrac,
            endFrac,
        });
    }
    return blocks;
}

// The credit line burnt into the video: the composer and the source. A shared file must
// carry the piece's provenance with it; the licence goes on the line below (licenseLine)
// and the wordmark's "plinky.fun" is rendered separately by the painter.
export function provenanceLine(attribution: Attribution): string {
    const parts: string[] = [];
    if (attribution.composer) {
        parts.push(attribution.composer);
    }
    if (attribution.source) {
        parts.push(attribution.source.label);
    }
    return parts.join(" · ");
}

// The licence, for the line of its own it now gets. Empty when the piece carries a licence
// the catalogue does not know, and then the line is simply not drawn.
//
// Spelled out rather than abbreviated: "CC BY-SA 4.0" is a code a reader either knows or
// does not, and the frame has room for the sentence it stands for.
export function licenseLine(attribution: Attribution): string {
    return attribution.license?.name ?? "";
}

// A rectangle on the pre-rendered score image, in image pixels — one or more per
// step (a chord's noteheads), collected by the exporter's off-screen render.
export type ScoreBox = { x: number; y: number; width: number; height: number };

// The score panel shows a sliding window of the (taller) score image. The window
// centres on the current step and clamps to the image, so the opening frames sit
// at the top and the closing frames at the bottom — never past an edge.
export function scoreWindowTop(centerY: number, windowHeight: number, imageHeight: number): number {
    const top = centerY - windowHeight / 2;
    return Math.max(0, Math.min(top, Math.max(0, imageHeight - windowHeight)));
}

// The panel the painter actually draws for the score: the ideal band shrunk to
// the sheet's own scaled height when the piece is shorter than the band (a
// one-system piece must not trail empty card below its single row), and centred
// within the band it was given so the stage stays balanced.
export function scorePanelRect(
    band: { y: number; height: number },
    panelWidth: number,
    sheet: { width: number; height: number },
): { y: number; height: number } {
    const scaledSheetHeight = (sheet.height / sheet.width) * panelWidth;
    const height = Math.min(band.height, scaledSheetHeight);
    return { y: band.y + (band.height - height) / 2, height };
}

// How many of the run's steps have sounded by the frame's latest onset (frameAt's
// currentOnsetMs, on the notes' clock) — the steps the painter colours as played.
// Before the first onset nothing is played.
export function playedStepCount(onsets: readonly number[], currentOnsetMs: number | null): number {
    if (currentOnsetMs === null) {
        return 0;
    }
    let count = 0;
    for (const onset of onsets) {
        if (onset <= currentOnsetMs) {
            count++;
        }
    }
    return count;
}

// Where the score window should centre at time t (notes clock): gliding from the
// current step's centre toward the next step's as its onset approaches, so the
// sheet scrolls smoothly instead of jumping per note. Clamps to the first and
// last steps outside the run.
export function stepCenterAt(
    onsets: readonly number[],
    centers: readonly number[],
    tMs: number,
): number {
    if (centers.length === 0) {
        return 0;
    }
    if (tMs <= (onsets[0] ?? 0)) {
        return centers[0] ?? 0;
    }
    for (let index = 0; index < onsets.length - 1; index++) {
        const a = onsets[index] ?? 0;
        const b = onsets[index + 1] ?? a;
        if (tMs < b) {
            // Clamped, because the two lists can be different lengths and often are: the
            // onsets are the take's own, while the centres come from an engraving whose
            // notes were quantised to a grid — a hand-played chord's three near-misses
            // collapse into one step. Reading past the end used to fall back to 0, which
            // is the TOP of the sheet: the score panel jumped back to bar one partway
            // through and stayed there. Holding the last centre keeps the page where the
            // music left it.
            const last = centers.length - 1;
            const from = centers[Math.min(index, last)] ?? 0;
            const to = centers[Math.min(index + 1, last)] ?? from;
            const progress = b > a ? (tMs - a) / (b - a) : 1;
            return from + (to - from) * progress;
        }
    }
    return centers[centers.length - 1] ?? 0;
}

// The tallest and shortest a white key may be drawn, as a multiple of its own width.
//
// A video keyboard is a piano seen from the player's side, so a key is foreshortened: you
// read the front of it, not its whole length. Straight on, a real white key is about 23mm
// by 145 — call it seven to one — and no view of a piano makes a key longer than that.
// Below about three to one it stops reading as a key at all and becomes a tile.
//
// The band exists because key height was a fraction of the FRAME's height and knew nothing
// about how wide a key had ended up. The same painter drew 1:3.9 in the app's landscape
// export and 1:12.2 in a portrait promo — the second is not a keyboard, it is a set of
// stripes, and the lip and sheen that make a key read as a solid object are sized off
// height, so at a twelfth of their width they overwhelm it.
export const KEY_LONGEST = 7;
export const KEY_SHORTEST = 3;

// How tall to draw the keyboard: the depth the caller asked for, held to a key shape a
// piano could actually have.
//
// `whiteWidth` is a white key's width in the same units as the returned height — pixels
// for a painter — which is what lets the answer depend on how many keys are in range and
// how wide the frame is rather than on the frame's height alone.
export function keyboardHeightFor(asked: number, whiteWidth: number): number {
    if (!(whiteWidth > 0) || !Number.isFinite(asked)) {
        return asked;
    }
    return Math.min(Math.max(asked, whiteWidth * KEY_SHORTEST), whiteWidth * KEY_LONGEST);
}
