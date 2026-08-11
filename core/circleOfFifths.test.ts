// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { CIRCLE, keyForTonic, neighbours, signatureNotes } from "./circleOfFifths";

describe("CIRCLE", () => {
    it("holds all twelve keys, each exactly once", () => {
        expect(CIRCLE).toHaveLength(12);
        expect(new Set(CIRCLE.map((key) => key.tonic)).size).toBe(12);
    });

    it("starts at C with no accidentals and climbs by fifths", () => {
        expect(CIRCLE[0]).toMatchObject({ tonic: 0, accidentals: 0 });
        // G, D, A — a fifth at a time, one sharp at a time.
        expect(CIRCLE[1]).toMatchObject({ tonic: 7, accidentals: 1 });
        expect(CIRCLE[2]).toMatchObject({ tonic: 2, accidentals: 2 });
        expect(CIRCLE[3]).toMatchObject({ tonic: 9, accidentals: 3 });
    });

    it("spells the flat keys as flats", () => {
        // F major takes B flat, never A sharp.
        expect(keyForTonic(5)).toMatchObject({ accidentals: -1, spelling: "flat" });
        expect(keyForTonic(10)).toMatchObject({ accidentals: -2, spelling: "flat" });
    });

    it("puts every relative minor a minor third below its major", () => {
        for (const key of CIRCLE) {
            expect((key.tonic + 9) % 12).toBe(key.relativeMinor);
        }
    });

    it("counts as many accidentals as the signature writes", () => {
        for (const key of CIRCLE) {
            expect(signatureNotes(key)).toHaveLength(Math.abs(key.accidentals));
        }
        // A major writes F sharp, C sharp, G sharp — in signature order, as names.
        expect(
            signatureNotes({ tonic: 9, accidentals: 3, spelling: "sharp", relativeMinor: 6 }),
        ).toEqual(["f-sharp", "c-sharp", "g-sharp"]);
        // B flat major writes B flat and E flat.
        expect(
            signatureNotes({ tonic: 10, accidentals: -2, spelling: "flat", relativeMinor: 7 }),
        ).toEqual(["b-flat", "e-flat"]);
    });
});

describe("signatureNotes", () => {
    it("writes one letter per accidental, never the same letter twice", () => {
        // A signature names seven letters at most, each once. Spelling it from pitch
        // classes broke exactly this: F sharp major printed "F" for its sixth sharp,
        // which both repeats a letter and claims to sharpen a note the key contains.
        for (const key of CIRCLE) {
            const names = signatureNotes(key);
            expect(names).toHaveLength(Math.abs(key.accidentals));
            const letters = names.map((name) => name[0]);
            expect(new Set(letters).size).toBe(letters.length);
        }
    });

    it("spells the sixth sharp as E sharp, not F", () => {
        const fSharpMajor = CIRCLE.find((key) => key.accidentals === 6);
        expect(fSharpMajor).toBeDefined();
        expect(signatureNotes(fSharpMajor as NonNullable<typeof fSharpMajor>)).toEqual([
            "f-sharp",
            "c-sharp",
            "g-sharp",
            "d-sharp",
            "a-sharp",
            "e-sharp",
        ]);
    });

    it("uses only accidentals — a signature never writes a natural", () => {
        for (const key of CIRCLE) {
            for (const name of signatureNotes(key)) {
                expect(name).toMatch(key.accidentals < 0 ? /-flat$/ : /-sharp$/);
            }
        }
    });
});

describe("neighbours", () => {
    it("names the keys a fifth either side", () => {
        const c = keyForTonic(0);
        expect(c).not.toBeNull();
        const around = neighbours(c as NonNullable<typeof c>);
        expect(around.up.tonic).toBe(7); // G
        expect(around.down.tonic).toBe(5); // F
    });

    it("wraps at the cut rather than running off the end", () => {
        // Past six sharps the circle meets itself; the reader is shown the key they
        // would actually be handed, not a seven-sharp signature nobody writes.
        const sharpest = CIRCLE.find((key) => key.accidentals === 6);
        expect(sharpest).toBeDefined();
        const around = neighbours(sharpest as NonNullable<typeof sharpest>);
        expect(CIRCLE.map((key) => key.tonic)).toContain(around.up.tonic);
        expect(around.down.tonic).toBe(11); // B, five sharps
    });
});
