// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The pure layout of the exported video's scene: where each piano key sits and
// what the credit line says. The painter applies these to a canvas; keeping the
// geometry and wording here keeps them testable and the painter thin.

import type { Attribution } from "./attribution";

// Black keys sit above the gap after these white-key positions within an
// octave (C, D, F, G, A — no black key after E and B).
const BLACK_AFTER = new Set([0, 2, 5, 7, 9]);

function isBlack(pitch: number): boolean {
    return [1, 3, 6, 8, 10].includes(pitch % 12);
}

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
    const lowest = pitches.length ? Math.min(...pitches) : 60;
    const highest = pitches.length ? Math.max(...pitches) : 60;
    let from = lowest - (lowest % 12);
    let to = highest + (11 - (highest % 12));
    while (to - from < 23) {
        from = Math.max(0, from - 12);
        to = to - from < 23 ? to + 12 : to;
    }
    return { from, to };
}

// Lay the keys of [from..to] across 0..1: white keys split the width evenly,
// each black key straddles the boundary after its white neighbour at 60% of a
// white key's width — the familiar piano proportions, resolution-independent.
export function sceneKeys(from: number, to: number): SceneKey[] {
    const whites: number[] = [];
    for (let pitch = from; pitch <= to; pitch++) {
        if (!isBlack(pitch)) {
            whites.push(pitch);
        }
    }
    const whiteWidth = 1 / Math.max(1, whites.length);
    const keys: SceneKey[] = whites.map((pitch, index) => ({
        pitch,
        x: index * whiteWidth,
        width: whiteWidth,
        black: false,
    }));
    for (let index = 0; index < whites.length; index++) {
        const pitch = whites[index]!;
        if (BLACK_AFTER.has(pitch % 12) && pitch + 1 <= to && pitch + 1 >= from) {
            keys.push({
                pitch: pitch + 1,
                x: (index + 1) * whiteWidth - whiteWidth * 0.3,
                width: whiteWidth * 0.6,
                black: true,
            });
        }
    }
    return keys;
}

// The credit line burnt into the video: the composer, the source, and the
// licence — a shared file must carry the piece's provenance with it, and the
// wordmark's "plinky.fun" is rendered separately by the painter.
export function creditLine(title: string, attribution: Attribution): string {
    const parts = [title];
    if (attribution.composer) {
        parts.push(attribution.composer);
    }
    if (attribution.source) {
        parts.push(attribution.source.label);
    }
    if (attribution.license) {
        parts.push(
            attribution.license.publicDomain ? "Public domain" : attribution.license.label,
        );
    }
    return parts.join(" · ");
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
