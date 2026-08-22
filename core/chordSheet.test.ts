// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { diatonicSheetDiagrams } from "./chordSheet";
import { isWhite } from "./keyboardGeometry";
import { svgDiagramSheet } from "./keyboardDiagram";
import { CHORD_DEGREES } from "./theory";

const C4 = 60;

describe("the diatonic chord sheet", () => {
    it("draws one diagram per degree, in the order the key builds them", () => {
        const sheet = diatonicSheetDiagrams(C4);
        expect(sheet).toHaveLength(CHORD_DEGREES.length);
        expect(sheet.map((one) => one.caption)).toEqual([
            "I · C",
            "ii · Dm",
            "iii · Em",
            "IV · F",
            "V · G",
            "vi · Am",
            "vii° · B°",
        ]);
    });

    it("spells the key it is in", () => {
        // In a flat key the sixth degree is B flat minor, never A sharp minor — the
        // picture has to agree with the signature a reader is holding it against.
        const flat = diatonicSheetDiagrams(C4 + 1, "flat");
        expect(flat[0]?.caption).toBe("I · D♭");
        expect(flat[5]?.caption).toBe("vi · B♭m");
    });

    it("draws every chord on the same keyboard, and starts that keyboard on a white key", () => {
        // A window that began mid-black-key would read as a photograph of a keyboard with
        // its edge cut off, and one that moved per chord would stop the seven pictures
        // being comparable at a glance — which is the reason they share a page.
        for (const tonic of [C4, C4 + 1, C4 + 6, C4 + 10]) {
            const sheet = diatonicSheetDiagrams(tonic);
            const first = sheet[0]!;
            expect(isWhite(first.from)).toBe(true);
            expect(isWhite(first.to)).toBe(true);
            expect(sheet.every((one) => one.from === first.from && one.to === first.to)).toBe(true);
            // Every note of every chord has to fall inside the drawn window, or a mark
            // lands on no key at all and simply vanishes from the picture.
            for (const one of sheet) {
                for (const key of one.keys) {
                    expect(key.note).toBeGreaterThanOrEqual(one.from);
                    expect(key.note).toBeLessThanOrEqual(one.to);
                }
            }
        }
    });

    it("stacks the diagrams down one page under a heading", () => {
        const svg = svgDiagramSheet({
            title: "Chords in C major",
            diagrams: diatonicSheetDiagrams(C4),
        });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain("Chords in C major");
        // Seven translated groups, each one placed below the last.
        const offsets = [...svg.matchAll(/translate\(0,([\d.]+)\)/g)].map((hit) => Number(hit[1]));
        expect(offsets).toHaveLength(CHORD_DEGREES.length);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        expect(new Set(offsets).size).toBe(offsets.length);
        // The page must be tall enough for the last diagram, or it is drawn outside the
        // document and never appears in the export.
        const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
        expect(height).toBeGreaterThan(offsets.at(-1)!);
    });

    it("escapes a heading that carries markup characters", () => {
        const svg = svgDiagramSheet({ title: 'A & B <"c">', diagrams: diatonicSheetDiagrams(C4) });
        expect(svg).toContain("A &amp; B &lt;&quot;c&quot;&gt;");
    });
});
