// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    INTERVAL_IDS,
    NATURAL_PITCH_CLASSES,
    intervalIdOf,
    noteNameOf,
    pitchClassOf,
    semitonesOf,
} from "./theory";

describe("pitchClassOf", () => {
    it("maps middle C to 0", () => {
        expect(pitchClassOf(60)).toBe(0);
    });

    it("folds every octave onto the same class", () => {
        expect(pitchClassOf(69)).toBe(pitchClassOf(81));
    });

    it("stays in range for a negative note", () => {
        expect(pitchClassOf(-1)).toBe(11);
    });
});

describe("noteNameOf", () => {
    it("names the naturals without an accidental", () => {
        expect(noteNameOf(0)).toBe("c");
        expect(noteNameOf(11)).toBe("b");
    });

    it("spells a black key both ways", () => {
        expect(noteNameOf(1, "sharp")).toBe("c-sharp");
        expect(noteNameOf(1, "flat")).toBe("d-flat");
    });

    it("defaults to sharps", () => {
        expect(noteNameOf(6)).toBe("f-sharp");
    });

    it("agrees with the natural set on which classes are white keys", () => {
        for (const pitchClass of NATURAL_PITCH_CLASSES) {
            expect(noteNameOf(pitchClass)).not.toContain("-");
        }
    });
});

describe("intervalIdOf", () => {
    it("names each interval within the octave", () => {
        expect(intervalIdOf(0)).toBe("unison");
        expect(intervalIdOf(7)).toBe("perfect-fifth");
        expect(intervalIdOf(12)).toBe("octave");
    });

    it("hears a descending interval as the same size", () => {
        expect(intervalIdOf(-4)).toBe("major-third");
    });

    it("folds a compound interval onto its simple form", () => {
        expect(intervalIdOf(16)).toBe("major-third"); // a major tenth
        expect(intervalIdOf(19)).toBe("perfect-fifth"); // a twelfth
    });

    it("keeps a multiple of an octave an octave rather than a unison", () => {
        expect(intervalIdOf(24)).toBe("octave");
    });
});

describe("semitonesOf", () => {
    it("round-trips every interval through its size", () => {
        for (const interval of INTERVAL_IDS) {
            expect(intervalIdOf(semitonesOf(interval))).toBe(interval);
        }
    });
});
