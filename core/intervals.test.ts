// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { intervalName } from "./intervals";

describe("intervalName", () => {
    it("names intervals up to an octave", () => {
        expect(intervalName(0)).toBe("a unison");
        expect(intervalName(7)).toBe("a perfect fifth");
        expect(intervalName(9)).toBe("a major sixth");
        expect(intervalName(12)).toBe("an octave");
    });

    it("names spans beyond an octave", () => {
        expect(intervalName(14)).toBe("an octave and a major second");
        expect(intervalName(24)).toBe("two octaves");
    });

    it("falls back to a bare semitone count past two octaves", () => {
        // No one names a span this wide, and it is past any hand's reach — the number
        // still reads correctly rather than coming out blank or undefined.
        expect(intervalName(25)).toBe("25 semitones");
        expect(intervalName(88)).toBe("88 semitones");
    });

    it("is sign-agnostic and rounds", () => {
        expect(intervalName(-9)).toBe("a major sixth");
        expect(intervalName(9.4)).toBe("a major sixth");
    });
});
