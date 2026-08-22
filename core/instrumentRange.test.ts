// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    effectiveRange,
    fitToInstrument,
    FULL_PIANO,
    type InstrumentRange,
    isFullPiano,
    keysIn,
    pitchRange,
    sizeFromName,
} from "./instrumentRange";

const SIXTY_ONE: InstrumentRange = { from: 36, to: 96 }; // C2–C7

describe("keysIn", () => {
    it("counts a full piano as 88 keys", () => {
        expect(keysIn(FULL_PIANO)).toBe(88);
        expect(isFullPiano(FULL_PIANO)).toBe(true);
    });

    it("counts a controller as the size it is sold as", () => {
        expect(keysIn(SIXTY_ONE)).toBe(61);
        expect(isFullPiano(SIXTY_ONE)).toBe(false);
    });
});

describe("sizeFromName", () => {
    it("reads the size out of the names keyboards are actually given", () => {
        expect(sizeFromName("Keystation 61 MK3")).toEqual(SIXTY_ONE);
        expect(sizeFromName("KOMPLETE KONTROL S61")).toEqual(SIXTY_ONE);
        expect(sizeFromName("Alesis V49")).toEqual({ from: 36, to: 84 });
        expect(sizeFromName("SL88 GRAND")).toEqual(FULL_PIANO);
    });

    it("reads nothing out of a model number that merely contains digits", () => {
        // The trap this guards: a loose match finds 25 inside 1100 and shrinks a
        // full-size stage piano to two octaves, silently, on every piece.
        expect(sizeFromName("PX-S1100")).toBeNull();
        expect(sizeFromName("Roland FP-30X")).toBeNull();
        expect(sizeFromName("Yamaha P-45")).toBeNull();
        expect(sizeFromName("CASIO USB-MIDI")).toBeNull();
    });
});

describe("effectiveRange", () => {
    it("assumes the full piano when nothing is known", () => {
        expect(effectiveRange(null, [])).toEqual(FULL_PIANO);
        expect(effectiveRange(null, ["Some Anonymous Controller"])).toEqual(FULL_PIANO);
    });

    it("takes the size from a connected instrument's own name", () => {
        expect(effectiveRange(null, ["Impact LX61+"])).toEqual(SIXTY_ONE);
    });

    it("prefers what the player measured over what a name suggests", () => {
        const measured = { from: 40, to: 90 };
        expect(effectiveRange(measured, ["Keystation 61 MK3"])).toEqual(measured);
    });

    it("reaches as wide as the instruments together, with two connected", () => {
        // Two keyboards on the desk means every key either one has is playable.
        expect(effectiveRange(null, ["Launchkey 25", "Keystation 61 MK3"])).toEqual({
            from: 36,
            to: 96,
        });
    });
});

describe("pitchRange", () => {
    it("has nothing to report for a piece with no notes", () => {
        expect(pitchRange([])).toBeNull();
    });

    it("spans the lowest and highest note played", () => {
        expect(pitchRange([60, 48, 72, 55])).toEqual({ from: 48, to: 72 });
    });
});

describe("fitToInstrument", () => {
    it("leaves a piece that already fits alone", () => {
        expect(fitToInstrument({ from: 60, to: 72 }, SIXTY_ONE)).toEqual({ kind: "fits", shift: 0 });
    });

    it("has nothing to do before a piece has been read", () => {
        expect(fitToInstrument(null, SIXTY_ONE)).toEqual({ kind: "fits", shift: 0 });
    });

    it("lifts a piece that dips below the lowest key", () => {
        // Down to C1, an octave under a 61-key keyboard's bottom C.
        const fit = fitToInstrument({ from: 24, to: 60 }, SIXTY_ONE);
        expect(fit).toEqual({ kind: "shifted", shift: 12 });
    });

    it("drops a piece that climbs past the highest key", () => {
        const fit = fitToInstrument({ from: 60, to: 104 }, SIXTY_ONE);
        expect(fit).toEqual({ kind: "shifted", shift: -12 });
    });

    it("moves by whole octaves even when a semitone would have done", () => {
        // Two notes past the top. A shift of 2 would fit and would change the piece's
        // key; an octave keeps every pitch class where the composer put it.
        expect(fitToInstrument({ from: 60, to: 98 }, SIXTY_ONE)).toEqual({
            kind: "shifted",
            shift: -12,
        });
    });

    it("gives up on a piece wider than the instrument", () => {
        // Six octaves of piece against five of keyboard: no offset contains it.
        expect(fitToInstrument({ from: 21, to: 108 }, SIXTY_ONE)).toEqual({
            kind: "beyond",
            shift: 0,
        });
    });

    it("gives up when no whole octave lands the piece inside", () => {
        // The piece is narrower than the instrument and still cannot go there: every
        // offset that would fit is between 1 and 5 semitones, and moving by those would
        // change the piece's key rather than its register.
        const tiny = { from: 60, to: 72 };
        expect(fitToInstrument({ from: 59, to: 67 }, tiny)).toEqual({ kind: "beyond", shift: 0 });
    });

    it("never has to move a piece on a full piano", () => {
        // Every score in the catalogue is engraved for one, so the default player never
        // sees a shift at all.
        expect(fitToInstrument({ from: 21, to: 108 }, FULL_PIANO).kind).toBe("fits");
    });
});
