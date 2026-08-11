// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    cleanChannel,
    defaultChannels,
    isChannel,
    LIGHT_PROFILE_IDS,
    MAX_CHANNEL,
    MIN_CHANNEL,
    suggestProfile,
} from "./lightProfile";

describe("defaultChannels", () => {
    it("uses each maker's documented navigation channels", () => {
        // Casio MIDI In Navigate: left-hand 3, right-hand 4.
        expect(defaultChannels("casio")).toEqual({ left: 3, right: 4 });
        // Yamaha Light Guide: Light Part 1 is channel 1 and carries the right hand.
        expect(defaultChannels("yamaha")).toEqual({ left: 2, right: 1 });
    });

    it("gives every profile two distinct, valid channels", () => {
        for (const id of LIGHT_PROFILE_IDS) {
            const channels = defaultChannels(id);
            expect(isChannel(channels.left)).toBe(true);
            expect(isChannel(channels.right)).toBe(true);
            // One channel for both hands would light the wrong keys on the wrong side.
            expect(channels.left).not.toBe(channels.right);
        }
    });
});

describe("isChannel", () => {
    it("accepts the sixteen MIDI has and nothing else", () => {
        expect(isChannel(MIN_CHANNEL)).toBe(true);
        expect(isChannel(MAX_CHANNEL)).toBe(true);
        expect(isChannel(0)).toBe(false);
        expect(isChannel(17)).toBe(false);
        expect(isChannel(4.5)).toBe(false);
    });
});

describe("cleanChannel", () => {
    it("keeps a real channel and falls back for anything else", () => {
        expect(cleanChannel(9, 4)).toBe(9);
        expect(cleanChannel(0, 4)).toBe(4);
        expect(cleanChannel("3", 4)).toBe(4);
        expect(cleanChannel(undefined, 4)).toBe(4);
        expect(cleanChannel(Number.NaN, 4)).toBe(4);
    });
});

describe("suggestProfile", () => {
    it("recognises the model names these makers ship", () => {
        expect(suggestProfile("CASIO USB-MIDI")).toBe("casio");
        expect(suggestProfile("LK-S450")).toBe("casio");
        expect(suggestProfile("Digital Keyboard EZ-310")).toBe("yamaha");
        expect(suggestProfile("YAMAHA Digital Keyboard")).toBe("yamaha");
    });

    it("suggests nothing for a device it does not know", () => {
        // A guess is a hint the player can overrule, never a claim that a device
        // lights its keys — most instruments by these makers have no lights at all.
        expect(suggestProfile("Roland FP-30")).toBeNull();
        expect(suggestProfile("USB MIDI Device")).toBeNull();
        expect(suggestProfile("")).toBeNull();
    });
});
