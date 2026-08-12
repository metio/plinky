// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type PedalSpan, pedalledAt, ringUntil } from "./pedal";

const span = (from: number, to: number): PedalSpan => ({ from, to });

describe("pedalledAt", () => {
    it("says no when the score marks no pedal at all", () => {
        expect(pedalledAt([], 0)).toBe(false);
        expect(pedalledAt([], 12)).toBe(false);
    });

    it("covers the span from the press up to the lift", () => {
        const spans = [span(0, 1.5)];
        // A note written at the moment the pedal goes down is one the pedal is for.
        expect(pedalledAt(spans, 0)).toBe(true);
        expect(pedalledAt(spans, 1)).toBe(true);
        // The note written where the pedal comes up is the note the pianist lifted for.
        expect(pedalledAt(spans, 1.5)).toBe(false);
    });

    it("handles a piece that pedals more than once", () => {
        const spans = [span(0, 1), span(4, 5)];
        expect(pedalledAt(spans, 2)).toBe(false);
        expect(pedalledAt(spans, 4.5)).toBe(true);
    });

    it("reads a marking written at a triplet's rounded onset", () => {
        const third = 1 / 3;
        expect(pedalledAt([span(third, 1)], third)).toBe(true);
    });
});

describe("ringUntil", () => {
    it("leaves an unpedalled note at its written length", () => {
        expect(ringUntil([], 0, 0.25)).toBe(0.25);
        expect(ringUntil([span(4, 5)], 0, 0.25)).toBe(0.25);
    });

    it("holds a note under the pedal until the pedal lifts", () => {
        // A quarter note struck at the top of a pedal that runs a bar and a half rings
        // for the whole of it.
        expect(ringUntil([span(0, 1.5)], 0, 0.25)).toBe(1.5);
        expect(ringUntil([span(0, 1.5)], 1, 0.25)).toBe(0.5);
    });

    it("never shortens a note the pedal outlives", () => {
        // A whole note struck just before the pedal lifts keeps its own length.
        expect(ringUntil([span(0, 1.5)], 1.4, 1)).toBe(1);
    });

    it("leaves the note written at the lift alone", () => {
        expect(ringUntil([span(0, 1.5)], 1.5, 0.5)).toBe(0.5);
    });

    it("takes the longest when spans overlap", () => {
        expect(ringUntil([span(0, 1), span(0, 3)], 0, 0.25)).toBe(3);
    });
});
