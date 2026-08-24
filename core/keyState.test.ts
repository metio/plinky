// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type KeyStateInput, keyState } from "./keyState";

const nothing: KeyStateInput = {
    flash: null,
    lit: new Set(),
    sounding: new Map(),
    expected: [],
};

describe("keyState", () => {
    it("says nothing about a key nothing is happening to", () => {
        expect(keyState(60, nothing)).toBe("rest");
    });

    it("reads each state on its own", () => {
        expect(keyState(60, { ...nothing, flash: 60 })).toBe("wrong");
        expect(keyState(60, { ...nothing, lit: new Set([60]) })).toBe("held");
        expect(keyState(60, { ...nothing, sounding: new Map([[60, "left"]]) })).toBe("left");
        expect(keyState(60, { ...nothing, sounding: new Map([[60, "right"]]) })).toBe("right");
        expect(keyState(60, { ...nothing, expected: [60] })).toBe("next");
    });

    it("puts the miss above everything, or the player cannot see what they got wrong", () => {
        expect(
            keyState(60, {
                flash: 60,
                lit: new Set([60]),
                sounding: new Map([[60, "left"]]),
                expected: [60],
            }),
        ).toBe("wrong");
    });

    it("puts the key the player is holding above the note the app is demonstrating", () => {
        // Their hands are the more urgent fact on the instrument in front of them.
        expect(
            keyState(60, { ...nothing, lit: new Set([60]), sounding: new Map([[60, "right"]]) }),
        ).toBe("held");
    });

    it("puts a held key and a demonstrated one above what the score asks for next", () => {
        expect(
            keyState(60, { ...nothing, sounding: new Map([[60, "left"]]), expected: [60] }),
        ).toBe("left");
        expect(keyState(60, { ...nothing, lit: new Set([60]), expected: [60] })).toBe("held");
    });

    it("leaves other notes alone", () => {
        const busy: KeyStateInput = {
            flash: 61,
            lit: new Set([62]),
            sounding: new Map([[63, "left"]]),
            expected: [64],
        };
        expect(keyState(60, busy)).toBe("rest");
    });
});
