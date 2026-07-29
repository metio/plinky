// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { noteOff, noteOn, sendable } from "./midiMessage";

describe("midi messages", () => {
    it("builds a note-on a keyboard will light", () => {
        expect(noteOn(60, 100)).toEqual([0x90, 60, 100]);
    });

    it("builds a note-off that even a fussy device understands", () => {
        // Velocity zero is the form some instruments only accept.
        expect(noteOff(60)).toEqual([0x80, 60, 0]);
    });

    it("keeps velocity inside the seven bits MIDI carries", () => {
        expect(noteOn(60, 999)[2]).toBe(127);
        expect(noteOn(60, -5)[2]).toBe(1);
        expect(noteOn(60, Number.NaN)[2]).toBe(64);
    });

    it("never sends a velocity of zero on a note-on", () => {
        // Zero would read as a note-off, so the key would light and instantly clear.
        expect(noteOn(60, 0)[2]).toBeGreaterThan(0);
    });

    it("refuses a note off the keyboard rather than wrapping it", () => {
        // Wrapping would light a key an octave from the one meant.
        expect(sendable(60)).toBe(true);
        expect(sendable(0)).toBe(true);
        expect(sendable(127)).toBe(true);
        expect(sendable(128)).toBe(false);
        expect(sendable(-1)).toBe(false);
        expect(sendable(60.5)).toBe(false);
        expect(sendable(Number.NaN)).toBe(false);
    });
});
