// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { echoChannel, noteOff, noteOn, sendable } from "./midiMessage";

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

describe("echoChannel", () => {
    it("stays on channel 1 when nothing is in the way", () => {
        expect(echoChannel([])).toBe(1);
    });

    it("steps aside when the lights are using its channel", () => {
        // Yamaha's Light Part 1 is channel 1 by default, so an echo left there makes
        // keys glow for notes nobody was asked to play.
        expect(echoChannel([2, 1])).toBe(3);
        expect(echoChannel([1, 2])).toBe(3);
    });

    it("keeps its channel when the lights are elsewhere", () => {
        // Casio navigates on 3 and 4, so there is nothing to avoid.
        expect(echoChannel([3, 4])).toBe(1);
    });

    it("takes the first channel that is free, counting up", () => {
        expect(echoChannel([1])).toBe(2);
        expect(echoChannel([1, 2, 3, 4])).toBe(5);
    });

    it("falls back rather than running off the end of the sixteen", () => {
        const everyChannel = Array.from({ length: 16 }, (_, index) => index + 1);
        expect(echoChannel(everyChannel)).toBe(1);
    });
});

describe("noteOn and noteOff on a chosen channel", () => {
    it("default to channel 1", () => {
        expect(noteOn(60, 64)[0]).toBe(0x90);
        expect(noteOff(60)[0]).toBe(0x80);
    });

    it("carry the channel they are given, counting from one", () => {
        expect(noteOn(60, 64, 3)[0]).toBe(0x92);
        expect(noteOff(60, 3)[0]).toBe(0x82);
        expect(noteOn(60, 64, 16)[0]).toBe(0x9f);
    });
});
