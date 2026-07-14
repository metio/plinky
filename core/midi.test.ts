// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, rebind } from "./keyMap";
import {
    holdScaleFor,
    IMPRECISE_HOLD_SCALE,
    isPreciseInput,
    MIC_DEVICE,
    KEYBOARD_DEVICE,
    keyToNote,
    noteName,
    ON_SCREEN_DEVICE,
    parseMidiMessage,
    pitchClass,
} from "./midi";

describe("noteName", () => {
    it("names middle C and its neighbours", () => {
        expect(noteName(60)).toBe("C4");
        expect(noteName(69)).toBe("A4");
        expect(noteName(61)).toBe("C#4");
        expect(noteName(72)).toBe("C5");
    });

    it("names a note below MIDI 0 with a floor-mod instead of indexing off the array", () => {
        expect(noteName(-1)).toBe("B-2");
        expect(noteName(-12)).toBe("C-2");
    });
});

describe("pitchClass", () => {
    it("gives the octave-free letter with a typographic sharp", () => {
        expect(pitchClass(60)).toBe("C");
        expect(pitchClass(72)).toBe("C");
        expect(pitchClass(61)).toBe("C♯");
    });

    it("floor-mods so notes below MIDI 0 still map", () => {
        expect(pitchClass(-12)).toBe("C");
        expect(pitchClass(-1)).toBe("B");
    });
});

describe("keyToNote", () => {
    it("maps the left hand to a full octave on the bottom row from C4", () => {
        expect(keyToNote("z", 0)).toBe(60); // C4
        expect(keyToNote("x", 0)).toBe(62); // D4
        expect(keyToNote("b", 0)).toBe(67); // G4
        expect(keyToNote("n", 0)).toBe(69); // A4
        expect(keyToNote("m", 0)).toBe(71); // B4
        expect(keyToNote("s", 0)).toBe(61); // C#4
        expect(keyToNote("g", 0)).toBe(66); // F#4
        expect(keyToNote("j", 0)).toBe(70); // A#4
    });

    it("maps the right hand to a full octave on the top row from C5", () => {
        expect(keyToNote("q", 0)).toBe(72); // C5
        expect(keyToNote("t", 0)).toBe(79); // G5
        expect(keyToNote("y", 0)).toBe(81); // A5
        expect(keyToNote("u", 0)).toBe(83); // B5
        expect(keyToNote("2", 0)).toBe(73); // C#5
        expect(keyToNote("7", 0)).toBe(82); // A#5
    });

    it("shifts both hands by the octave offset", () => {
        expect(keyToNote("z", 1)).toBe(72);
        expect(keyToNote("q", -1)).toBe(60);
    });

    it("returns null for keys outside the layout", () => {
        for (const key of ["a", "f", "k", "l", "o", "p", "i", "1", "8", ";"]) {
            expect(keyToNote(key, 0)).toBeNull();
        }
    });

    it("honours a custom key map", () => {
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "a");
        expect(keyToNote("a", 0, custom)).toBe(60); // 'a' now plays the left hand's C4
        expect(keyToNote("z", 0, custom)).toBeNull(); // the default 'z' is no longer bound
    });

    it("lower-cases the key so a shifted glyph still resolves", () => {
        expect(keyToNote("Z", 0)).toBe(60);
        expect(keyToNote("Q", 0)).toBe(72);
    });

    it("returns null rather than sounding a note above the 88-key piano", () => {
        // The top row at the maximum offset would land past C8 (108); no piano has it.
        expect(keyToNote("u", 3)).toBeNull(); // B5 + 3 octaves = 119
        expect(keyToNote("q", 3)).toBe(108); // C5 + 3 octaves = C8, the top key, still valid
    });
});

describe("parseMidiMessage", () => {
    it("decodes a note-on with velocity and channel", () => {
        expect(parseMidiMessage(new Uint8Array([0x90, 60, 100]))).toEqual({
            kind: "noteon",
            note: 60,
            velocity: 100,
            channel: 1,
        });
    });

    it("treats a zero-velocity note-on as a note-off", () => {
        expect(parseMidiMessage(new Uint8Array([0x92, 64, 0]))).toEqual({
            kind: "noteoff",
            note: 64,
            velocity: 0,
            channel: 3,
        });
    });

    it("decodes an explicit note-off", () => {
        expect(parseMidiMessage(new Uint8Array([0x80, 64, 40]))?.kind).toBe("noteoff");
    });

    it("ignores non-note messages and short data", () => {
        expect(parseMidiMessage(new Uint8Array([0xb0, 7, 100]))).toBeNull();
        expect(parseMidiMessage(new Uint8Array([0x90]))).toBeNull();
        expect(parseMidiMessage(null)).toBeNull();
    });

    it("decodes the three pedals (CC64/66/67), down in the upper half, up below", () => {
        expect(parseMidiMessage(new Uint8Array([0xb0, 64, 127]))).toEqual({
            kind: "pedal",
            pedal: "sustain",
            down: true,
            channel: 1,
        });
        expect(parseMidiMessage(new Uint8Array([0xb0, 66, 100]))).toMatchObject({
            pedal: "sostenuto",
            down: true,
        });
        expect(parseMidiMessage(new Uint8Array([0xb0, 67, 10]))).toMatchObject({
            pedal: "soft",
            down: false,
        });
        expect(parseMidiMessage(new Uint8Array([0xb0, 64, 64]))).toMatchObject({ down: true });
        expect(parseMidiMessage(new Uint8Array([0xb0, 64, 63]))).toMatchObject({ down: false });
        expect(parseMidiMessage(new Uint8Array([0xb1, 64, 0]))).toMatchObject({
            pedal: "sustain",
            down: false,
            channel: 2,
        });
    });

    it("ignores control changes that aren't one of the three pedals", () => {
        // The modulation wheel (CC1) and every other non-pedal controller decode to null.
        expect(parseMidiMessage(new Uint8Array([0xb0, 1, 100]))).toBeNull();
        expect(parseMidiMessage(new Uint8Array([0xb0, 7, 100]))).toBeNull();
    });
});

describe("isPreciseInput", () => {
    it("treats a real MIDI device as precise", () => {
        expect(isPreciseInput("Roland FP-30")).toBe(true);
    });

    it("treats the microphone as imprecise, so mic runs get the widened windows", () => {
        expect(isPreciseInput(MIC_DEVICE)).toBe(false);
    });

    it("treats the keyboard fallbacks as imprecise", () => {
        expect(isPreciseInput(ON_SCREEN_DEVICE)).toBe(false);
        expect(isPreciseInput(KEYBOARD_DEVICE)).toBe(false);
    });
});

describe("holdScaleFor", () => {
    it("rings the tap keyboards on so a short click still sings", () => {
        expect(holdScaleFor(ON_SCREEN_DEVICE)).toBe(IMPRECISE_HOLD_SCALE);
        expect(holdScaleFor(KEYBOARD_DEVICE)).toBe(IMPRECISE_HOLD_SCALE);
        expect(IMPRECISE_HOLD_SCALE).toBeGreaterThan(1);
    });

    it("leaves a real MIDI key untouched", () => {
        expect(holdScaleFor("Roland FP-30")).toBe(1);
    });

    it("leaves the microphone untouched — it opens no live voice", () => {
        expect(holdScaleFor(MIC_DEVICE)).toBe(1);
    });
});
