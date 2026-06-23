// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {describe, expect, it} from "vitest";
import {noteName, parseMidiMessage} from "./midi";

describe("noteName", () => {
    it("names middle C and its neighbours", () => {
        expect(noteName(60)).toBe("C4");
        expect(noteName(69)).toBe("A4");
        expect(noteName(61)).toBe("C#4");
        expect(noteName(72)).toBe("C5");
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
});
