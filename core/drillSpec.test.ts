// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_DRILL, type DrillOptions, generateDrill, MAX_FIFTHS, MIN_FIFTHS } from "./drill";
import { clampDrill, DRILL_FIELDS, keyName } from "./drillSpec";

describe("keyName", () => {
    it("names the signature the way a reader would", () => {
        expect(keyName(0)).toBe("C");
        expect(keyName(1)).toBe("G");
        expect(keyName(-1)).toBe("F");
        expect(keyName(MAX_FIFTHS)).toBe("C#");
        expect(keyName(MIN_FIFTHS)).toBe("Cb");
    });

    it("names something for every signature the fields offer", () => {
        for (let fifths = MIN_FIFTHS; fifths <= MAX_FIFTHS; fifths++) {
            expect(keyName(fifths)).toMatch(/^[A-G][b#]?$/);
        }
    });
});

describe("DRILL_FIELDS", () => {
    it("describes each option once", () => {
        const ids = DRILL_FIELDS.map((field) => field.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it("bounds every numeric field the way clamping does", () => {
        // The panel and the clamp must agree, or a value the UI offers could be
        // rewritten the moment it is used.
        for (const field of DRILL_FIELDS) {
            if (field.kind !== "number") {
                continue;
            }
            const atMax = clampDrill({ ...DEFAULT_DRILL, [field.id]: field.max });
            const atMin = clampDrill({ ...DEFAULT_DRILL, [field.id]: field.min });

            expect(atMax[field.id as keyof DrillOptions]).toBe(field.max);
            expect(atMin[field.id as keyof DrillOptions]).toBe(field.min);
        }
    });
});

describe("clampDrill", () => {
    it("pulls every out-of-range value back to something playable", () => {
        const clamped = clampDrill({
            ...DEFAULT_DRILL,
            bars: 9999,
            fifths: 40,
            low: -20,
            high: 9000,
            notesPerColumn: 99,
            maxLeap: -5,
            smoothness: 100,
        });

        expect(clamped.bars).toBe(32);
        expect(clamped.fifths).toBe(MAX_FIFTHS);
        expect(clamped.low).toBe(21);
        expect(clamped.high).toBe(108);
        expect(clamped.notesPerColumn).toBe(4);
        expect(clamped.maxLeap).toBe(0);
        expect(clamped.smoothness).toBe(6);
    });

    it("reads a range as the span it names, whichever way round", () => {
        const clamped = clampDrill({ ...DEFAULT_DRILL, low: 84, high: 48 });

        expect(clamped.low).toBe(48);
        expect(clamped.high).toBe(84);
    });

    it("replaces junk rather than passing it to the generator", () => {
        const clamped = clampDrill({
            ...DEFAULT_DRILL,
            bars: Number.NaN,
            rhythm: "sideways" as never,
            hands: 7 as never,
            chromatic: "yes" as never,
        });

        expect(clamped.bars).toBe(1);
        expect(clamped.rhythm).toBe("quarters");
        expect(clamped.hands).toBe(1);
        expect(clamped.chromatic).toBe(false);
    });

    it("leaves a clamped drill generatable", () => {
        // The point of clamping: whatever arrives, a drill comes out.
        const xml = generateDrill(
            clampDrill({ ...DEFAULT_DRILL, low: 500, high: -500, bars: Number.NaN }),
            Math.random,
        );

        expect(xml).toContain("<score-partwise");
        expect(xml).toContain("<note>");
    });
});
