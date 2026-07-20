// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { grooveAccents } from "./groove";

// The accented on-beats of a 4-beat bar under a groove.
const accentsIn = (groove: Parameters<typeof grooveAccents>[0], beatsPerBar: number) =>
    Array.from({ length: beatsPerBar }, (_, beat) => beat).filter((beat) =>
        grooveAccents(groove, beat, beatsPerBar),
    );

describe("grooveAccents", () => {
    it("straight accents only the downbeat", () => {
        expect(accentsIn("straight", 4)).toEqual([0]);
        expect(accentsIn("straight", 3)).toEqual([0]);
    });

    it("backbeat accents beats 2 and 4", () => {
        expect(accentsIn("backbeat", 4)).toEqual([1, 3]);
    });

    it("two-feel accents beats 1 and 3", () => {
        expect(accentsIn("twoFeel", 4)).toEqual([0, 2]);
    });

    it("falls back to the downbeat in a bar too short for the groove", () => {
        // No beat 2 to lean on, so backbeat keeps a clear beat one.
        expect(accentsIn("backbeat", 1)).toEqual([0]);
        // No beat 3, so two-feel collapses to the downbeat.
        expect(accentsIn("twoFeel", 2)).toEqual([0]);
    });
});
