// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { decodeIncipit } from "./incipit";
import { drawIncipit, headColor, incipitSvg } from "./incipitDraw";
import { BOOMWHACKER_SET } from "./pitchColor";

// A treble opening: C5 (crotchet), E5 sharp (minim), G3 (semibreve, below the staff).
const MARK = decodeIncipit("G35q#37h27w");
if (!MARK) {
    throw new Error("fixture mark did not decode");
}

describe("drawIncipit", () => {
    const drawing = drawIncipit(MARK, 10);

    it("sizes the mark by its space: one slot per note, margins for ledger lines", () => {
        expect(drawing.width).toBe(2 * 10 + 3 * 25);
        expect(drawing.height).toBe(4 * 10 + 2 * 30);
        expect(drawing.staff).toHaveLength(5);
        expect(drawing.hairline).toBeCloseTo(1.1);
        expect(drawing.stroke).toBeCloseTo(1.5);
    });

    it("places heads one slot apart, stems turning at the middle line", () => {
        const [c5, e5, g3] = drawing.heads;
        expect((e5?.x ?? 0) - (c5?.x ?? 0)).toBe(25);
        // C5 sits above the middle line: its stem goes down, on the head's left.
        expect(c5?.stem?.x1).toBeLessThan(c5?.x ?? 0);
        expect(c5?.stem?.y2).toBeGreaterThan(c5?.y ?? 0);
        // G3, far below, stems up on the right — no: a semibreve carries no stem.
        expect(g3?.stem).toBeNull();
        expect(g3?.hollow).toBe(true);
        expect(g3?.ledgers.length).toBeGreaterThan(0);
        expect(c5?.ledgers).toEqual([]);
    });

    it("draws a sharp as four strokes beside the head, and nothing for a natural", () => {
        const [c5, e5] = drawing.heads;
        expect(c5?.accidental).toBeNull();
        expect(e5?.accidental?.lines).toHaveLength(4);
        expect(e5?.accidental?.paths).toEqual([]);
        expect(e5?.accidental?.lines[0]?.x1).toBeLessThan(e5?.x ?? 0);
    });

    it("draws a flat as a stroke and a curve", () => {
        const flat = decodeIncipit("Gb35q");
        const [head] = drawIncipit(flat ?? MARK, 10).heads;
        expect(head?.accidental?.lines).toHaveLength(1);
        expect(head?.accidental?.paths).toHaveLength(1);
    });

    it("names each head's colour from the score's own set", () => {
        expect(headColor(0)).toBe(BOOMWHACKER_SET[0]);
        expect(headColor(6)).toBe(BOOMWHACKER_SET[6]);
        expect(headColor(9)).toBe("currentColor");
    });
});

describe("incipitSvg", () => {
    it("renders the drawing as one SVG in the given ink", () => {
        const svg = incipitSvg(MARK, { space: 10, ink: "#123456" });
        expect(svg.startsWith("<svg ")).toBe(true);
        expect(svg).toContain('viewBox="0 0 95 100"');
        expect(svg.match(/<ellipse /g)).toHaveLength(3);
        expect(svg).toContain('fill="#123456"');
        expect(svg).not.toContain("currentColor");
        // The hollow semibreve is outlined, not filled.
        expect(svg).toContain('fill="none" stroke="#123456"');
    });

    it("colours heads by name when asked", () => {
        const svg = incipitSvg(MARK, { space: 10, ink: "#000", colored: true });
        expect(svg).toContain(`fill="${BOOMWHACKER_SET[0]}"`);
    });
});
