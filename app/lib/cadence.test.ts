// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { cadence } from "./cadence";
import type { Letter } from "./grade";

describe("cadence", () => {
    it("plays the full rising arpeggio for an aced run", () => {
        expect(cadence("S").map((beat) => beat.note)).toEqual([72, 76, 79, 84]);
        expect(cadence("A").map((beat) => beat.note)).toEqual([72, 76, 79, 84]);
    });

    it("plays a resolved triad for a solid run", () => {
        expect(cadence("B").map((beat) => beat.note)).toEqual([72, 76, 79]);
        expect(cadence("C").map((beat) => beat.note)).toEqual([72, 76, 79]);
    });

    it("still gives a warm two-note lift for a weak run — never a penalty", () => {
        for (const letter of ["D", "E", "F"] as Letter[]) {
            expect(cadence(letter).map((beat) => beat.note)).toEqual([72, 79]);
        }
    });

    it("schedules every grade's notes in rising time order", () => {
        for (const letter of ["S", "A", "B", "C", "D", "E", "F"] as Letter[]) {
            const beats = cadence(letter);
            for (let index = 1; index < beats.length; index++) {
                expect(beats[index]!.at).toBeGreaterThan(beats[index - 1]!.at);
            }
        }
    });

    it("holds off at least two seconds before the first strike so it lands after the run settles", () => {
        for (const letter of ["S", "A", "B", "C", "D", "E", "F"] as Letter[]) {
            expect(cadence(letter)[0]!.at).toBeGreaterThanOrEqual(2);
        }
    });

    it("lands the final note longer and louder so the flourish resolves", () => {
        const beats = cadence("S");
        const last = beats[beats.length - 1]!;
        expect(last.duration).toBeGreaterThan(beats[0]!.duration);
        expect(last.velocity).toBeGreaterThan(beats[0]!.velocity);
    });
});
