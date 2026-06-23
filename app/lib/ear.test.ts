// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { EAR_NOTES, nextEarNote } from "./ear";

describe("nextEarNote", () => {
    it("picks from the pool deterministically for a given rng", () => {
        expect(nextEarNote(() => 0)).toBe(EAR_NOTES[0]);
        expect(nextEarNote(() => 0.999)).toBe(EAR_NOTES[EAR_NOTES.length - 1]);
    });

    it("never repeats the previous note", () => {
        // rng 0 would pick index 0, but with that note excluded it shifts along.
        expect(nextEarNote(() => 0, EAR_NOTES[0])).not.toBe(EAR_NOTES[0]);
    });
});
