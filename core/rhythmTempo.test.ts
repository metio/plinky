// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { Hit } from "./rhythm";
import { rhythmTempoPoints } from "./rhythmTempo";

const TEMPO = 100;
// Four crotchets at 100 bpm: 600 ms apart.
const ONSETS = [0, 600, 1200, 1800];
const hit = (index: number, deltaMs: number): Hit => ({ index, deltaMs, rating: "perfect" });
const perfect = ONSETS.map((_, index) => hit(index, 0));

describe("rhythmTempoPoints", () => {
    it("draws the configured tempo flat when every tap lands on the beat", () => {
        const points = rhythmTempoPoints(ONSETS, perfect, TEMPO);
        expect(points).toHaveLength(3);
        for (const point of points) {
            expect(point.bpm).toBeCloseTo(TEMPO);
        }
    });

    it("reads a rushed gap as faster and a dragged one as slower", () => {
        // The point of the picture: a count of perfect/good/off cannot say WHERE the pulse
        // went, and a steady tap slightly late scores like one that falls apart.
        const rushed = rhythmTempoPoints(
            ONSETS,
            [hit(0, 0), hit(1, -300), hit(2, 0), hit(3, 0)],
            TEMPO,
        );
        expect(rushed[0]?.bpm).toBeGreaterThan(TEMPO);
        // …and the gap after it is correspondingly long, so the line comes back down.
        expect(rushed[1]?.bpm).toBeLessThan(TEMPO);
    });

    it("is flat for a tap that is steadily late, because the PULSE never changed", () => {
        // Every tap 100 ms behind is a pulse held perfectly, started late. The gaps are all
        // correct, so the speed line is flat — which is exactly what it should say.
        const late = ONSETS.map((_, index) => hit(index, 100));
        for (const point of rhythmTempoPoints(ONSETS, late, TEMPO)) {
            expect(point.bpm).toBeCloseTo(TEMPO);
        }
    });

    it("spans a missed note rather than breaking the line", () => {
        // A gap has to be measured from something that was actually tapped; measuring from
        // a note nobody played would invent a tempo out of a silence.
        const points = rhythmTempoPoints(ONSETS, [hit(0, 0), null, hit(2, 0), hit(3, 0)], TEMPO);
        expect(points.map((point) => point.index)).toEqual([2, 3]);
        expect(points[0]?.bpm).toBeCloseTo(TEMPO);
    });

    it("has no first point, because a gap needs two notes", () => {
        expect(rhythmTempoPoints(ONSETS, perfect, TEMPO).some((p) => p.index === 0)).toBe(false);
    });

    it("says nothing about a run with nothing in it", () => {
        expect(rhythmTempoPoints([], [], TEMPO)).toEqual([]);
        expect(rhythmTempoPoints(ONSETS, [null, null, null, null], TEMPO)).toEqual([]);
        expect(rhythmTempoPoints([0], [hit(0, 0)], TEMPO)).toEqual([]);
    });

    it("refuses to plot a gap that did not pass any time", () => {
        // Two taps at the same instant would be an infinite tempo, and a double-tap on one
        // note is a thing a real player does.
        const points = rhythmTempoPoints([0, 600], [hit(0, 0), hit(1, -600)], TEMPO);
        expect(points).toEqual([]);
    });
});
