// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { KEYBOARD_DEVICE, MIC_DEVICE, ON_SCREEN_DEVICE, soundsOnItsOwn } from "./midi";

const STAND_INS = [ON_SCREEN_DEVICE, KEYBOARD_DEVICE, MIC_DEVICE];

describe("soundsOnItsOwn (properties)", () => {
    it("follows the setting for any device name that is not a stand-in", () => {
        fc.assert(
            fc.property(fc.string(), fc.boolean(), (device, instrumentSounds) => {
                fc.pre(!STAND_INS.includes(device));
                expect(soundsOnItsOwn(device, instrumentSounds)).toBe(instrumentSounds);
            }),
        );
    });

    it("never leaves a note to itself that the setting would voice, except the microphone's", () => {
        // Turning the setting on can only take voices away, never add one.
        fc.assert(
            fc.property(fc.constantFrom(...STAND_INS, "Yamaha P-125"), (device) => {
                if (soundsOnItsOwn(device, false)) {
                    expect(device).toBe(MIC_DEVICE);
                }
                expect(soundsOnItsOwn(device, true) || !soundsOnItsOwn(device, false)).toBe(true);
            }),
        );
    });
});
