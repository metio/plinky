// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { slurredOnwardAt } from "./slur";

const SPAN = [{ from: 1, to: 2 }];

describe("where a slur joins notes", () => {
    it("joins the first note under the arch", () => {
        expect(slurredOnwardAt(SPAN, 1)).toBe(true);
    });

    it("joins every note in the middle, which carry no mark of their own", () => {
        // The defect this pins: the engraving hangs the arch on its two end notes only, so
        // asking each note whether it is slurred joined the first pair and left the rest of
        // the phrase detached.
        expect(slurredOnwardAt(SPAN, 1.25)).toBe(true);
        expect(slurredOnwardAt(SPAN, 1.75)).toBe(true);
    });

    it("does not join the last note under the arch", () => {
        // The phrase stops there; holding it over would smear into what follows.
        expect(slurredOnwardAt(SPAN, 2)).toBe(false);
    });

    it("joins nothing outside the arch", () => {
        expect(slurredOnwardAt(SPAN, 0.5)).toBe(false);
        expect(slurredOnwardAt(SPAN, 3)).toBe(false);
        expect(slurredOnwardAt([], 1)).toBe(false);
    });

    it("tolerates an onset that rounding moved by a hair", () => {
        // Onsets are summed from fractions, so the first note under an arch can arrive a
        // few bits under its own start and drop out of its own slur.
        expect(slurredOnwardAt(SPAN, 1 - 1e-9)).toBe(true);
        expect(slurredOnwardAt(SPAN, 2 - 1e-9)).toBe(false);
    });

    it("joins a note covered by any of several arches", () => {
        const spans = [
            { from: 0, to: 0.5 },
            { from: 2, to: 3 },
        ];
        expect(slurredOnwardAt(spans, 0.25)).toBe(true);
        expect(slurredOnwardAt(spans, 2.5)).toBe(true);
        expect(slurredOnwardAt(spans, 1)).toBe(false);
    });
});
