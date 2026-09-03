// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, rebind } from "./keyMap";
import {
    holdScaleFor,
    IMPRECISE_HOLD_SCALE,
    isFocusGatedInput,
    isInstrumentInput,
    isPreciseInput,
    KEYBOARD_DEVICE,
    keyToNote,
    MIC_DEVICE,
    noteName,
    ON_SCREEN_DEVICE,
    parseMidiMessage,
    pitchClass,
    spokenPitch,
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

    it("lifts a key two octaves with Shift, so the four octaves run without a gap", () => {
        // The unshifted rows end at B5; the shifted ones start at the C above it.
        expect(keyToNote("u", 0)).toBe(83); // B5, the top of the unshifted layout
        expect(keyToNote("z", 0, DEFAULT_KEY_MAP, true)).toBe(84); // C6, the next note up
        expect(keyToNote("u", 0, DEFAULT_KEY_MAP, true)).toBe(107); // B7, the top of it
    });

    it("shifts nothing onto a note the other hand already plays", () => {
        // The rows stand an octave apart, so a one-octave lift would make the shifted left
        // hand a duplicate of the right. Two octaves buys two new ones instead.
        const shiftedLeft = keyToNote("z", 0, DEFAULT_KEY_MAP, true);
        expect(shiftedLeft).not.toBe(keyToNote("q", 0));
    });

    it("adds the Shift lift to the octave offset rather than replacing it", () => {
        expect(keyToNote("z", -2, DEFAULT_KEY_MAP, true)).toBe(60);
        expect(keyToNote("z", 1, DEFAULT_KEY_MAP, true)).toBe(96);
    });

    it("keeps a rebound key shiftable", () => {
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "a");
        expect(keyToNote("a", 0, custom, true)).toBe(84);
    });

    it("drops a shifted note that would land above the piano", () => {
        // The top row at the top offset is already at the ceiling; Shift cannot go higher.
        expect(keyToNote("q", 3, DEFAULT_KEY_MAP, true)).toBeNull();
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

    it("reads all-sound-off / reset / all-notes-off (CC120/121/123) as a reset", () => {
        for (const controller of [120, 121, 123]) {
            expect(parseMidiMessage(new Uint8Array([0xb2, controller, 0]))).toEqual({
                kind: "reset",
                channel: 3,
            });
        }
        // CC122 (local control) is not one of them and stays ignored.
        expect(parseMidiMessage(new Uint8Array([0xb0, 122, 0]))).toBeNull();
    });

    it("rejects a note or velocity with the high bit set (a malformed 8-bit data byte)", () => {
        // A data byte ≥128 can only be a status byte; the message is malformed, so it must
        // not sound a phantom pitch that would then never receive a matching note-off.
        expect(parseMidiMessage(new Uint8Array([0x90, 0x85, 100]))).toBeNull();
        expect(parseMidiMessage(new Uint8Array([0x90, 60, 0x85]))).toBeNull();
    });
});

describe("isFocusGatedInput", () => {
    it("gates the keyboard fallbacks, whose release event is lost when focus leaves", () => {
        expect(isFocusGatedInput(ON_SCREEN_DEVICE)).toBe(true);
        expect(isFocusGatedInput(KEYBOARD_DEVICE)).toBe(true);
    });

    it("does not gate a MIDI device or the mic, which keep streaming their own note-offs", () => {
        expect(isFocusGatedInput("Roland FP-30")).toBe(false);
        expect(isFocusGatedInput(MIC_DEVICE)).toBe(false);
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

describe("spokenPitch", () => {
    it("spells the sharp, which the glyph would have a screen reader say as a number", () => {
        expect(spokenPitch(61)).toBe("C sharp 4");
    });

    it("spaces the octave off the letter so it is announced as its own figure", () => {
        expect(spokenPitch(60)).toBe("C 4");
        expect(spokenPitch(72)).toBe("C 5");
    });

    it("numbers the octaves the way a piano is labelled, middle C in the fourth", () => {
        expect(spokenPitch(21)).toBe("A 0"); // the lowest key of an 88-key piano
        expect(spokenPitch(108)).toBe("C 8"); // and the highest
    });
});

describe("isInstrumentInput", () => {
    it("is true only for a device somebody is actually playing", () => {
        // It decides whether Plinky voices the note. A real instrument may be sounding it
        // already; a drawn key, a typed key and a microphone make no sound of their own.
        expect(isInstrumentInput("Yamaha P-125")).toBe(true);
        expect(isInstrumentInput(ON_SCREEN_DEVICE)).toBe(false);
        expect(isInstrumentInput(KEYBOARD_DEVICE)).toBe(false);
        expect(isInstrumentInput(MIC_DEVICE)).toBe(false);
    });
});
