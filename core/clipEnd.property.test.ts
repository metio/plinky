// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type ClipNote,
    type ClipWindow,
    clipCut,
    ENDING_MS,
    PROMO_WINDOW,
    RING_MS,
} from "./clipEnd";

// Notes over the half-minute a clip is cut from and a little past it, with lengths that
// run from staccato to a pedal note held under everything — so overlapping textures, bare
// silence and long ring-outs across the window's far edge all occur often.
const notes: fc.Arbitrary<ClipNote[]> = fc.array(
    fc.record({
        startMs: fc.integer({ min: 0, max: 40_000 }),
        durationMs: fc.integer({ min: 0, max: 12_000 }),
    }),
    { maxLength: 120 },
);

const windows: fc.Arbitrary<ClipWindow> = fc
    .tuple(
        fc.integer({ min: 1_000, max: 30_000 }),
        fc.integer({ min: 500, max: 20_000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
    )
    .map(([earliestMs, width, where]) => ({
        earliestMs,
        latestMs: earliestMs + width,
        targetMs: earliestMs + Math.round(width * where),
    }));

const endOf = (list: readonly ClipNote[]): number =>
    list.reduce((end, note) => Math.max(end, note.startMs + note.durationMs), 0);

describe("clipCut", () => {
    it("never runs past the window it was given", () => {
        // The one that was not held. A note struck just inside the far edge and still
        // ringing at it used to carry the clip along with it — a thirty-second window
        // producing thirty-five seconds of video.
        fc.assert(
            fc.property(notes, windows, (list, window) => {
                expect(clipCut(list, window).durationMs).toBeLessThanOrEqual(
                    window.latestMs + ENDING_MS,
                );
            }),
        );
    });

    it("keeps exactly the notes that start before the cut", () => {
        fc.assert(
            fc.property(notes, windows, (list, window) => {
                const cut = clipCut(list, window);
                expect(cut.notes).toEqual(list.filter((note) => note.startMs < cut.endMs));
            }),
        );
    });

    it("cuts where nothing is sounding whenever a silence decided it", () => {
        fc.assert(
            fc.property(notes, windows, (list, window) => {
                const cut = clipCut(list, window);
                fc.pre(cut.pauseMs !== undefined);
                // Every kept note has been released by the cut, which is what makes it read
                // as a breath rather than as a stumble.
                expect(endOf(cut.notes)).toBeLessThanOrEqual(cut.endMs);
            }),
        );
    });

    it("stops no earlier than the music it keeps", () => {
        fc.assert(
            fc.property(notes, windows, (list, window) => {
                const cut = clipCut(list, window);
                expect(cut.durationMs).toBeGreaterThanOrEqual(
                    Math.min(endOf(cut.notes), window.latestMs),
                );
            }),
        );
    });

    it("plays the whole piece when no window is given", () => {
        fc.assert(
            fc.property(notes, (list) => {
                const cut = clipCut(list, null);
                expect(cut.notes).toEqual(list);
                expect(cut.durationMs).toBe(Math.round(endOf(list) + ENDING_MS));
            }),
        );
    });

    it("ends within the promo window or at a natural ending inside it", () => {
        fc.assert(
            fc.property(notes, (list) => {
                const cut = clipCut(list, PROMO_WINDOW);
                expect(cut.endMs).toBeLessThanOrEqual(PROMO_WINDOW.latestMs);
                expect(cut.durationMs).toBeLessThanOrEqual(PROMO_WINDOW.latestMs + ENDING_MS);
            }),
        );
    });

    it("gives a cut less room to ring than an ending", () => {
        expect(RING_MS).toBeLessThan(ENDING_MS);
    });
});
