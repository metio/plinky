// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a particular lighted keyboard wants to be told which keys to light.
//
// Every instrument in the first compatibility set takes plain MIDI note messages —
// what differs is only which channel means which hand. That is worth stating twice,
// because it decides how much of this there is: no SysEx, no vendor handshake, and so
// no `sysex: true` on the MIDI request and no second permission prompt. A keyboard
// with per-key colour (ROLI's LUMI) would need all of that, which is why it is not in
// this list.
//
// The channels are DEFAULTS, not constants. Both makers let the player change them on
// the instrument, so a profile seeds the setting and the setting is what is sent.

export type LightProfileId = "casio" | "yamaha" | "custom";

export const LIGHT_PROFILE_IDS: LightProfileId[] = ["casio", "yamaha", "custom"];

// MIDI channels are 1..16 to a reader and 0..15 on the wire; everything here is the
// reader's numbering, converted once at the point the bytes are built.
export const MIN_CHANNEL = 1;
export const MAX_CHANNEL = 16;

export type LightChannels = { left: number; right: number };

// Casio's "MIDI In Navigate" (LK-S250, LK-S450): the keyboard lights whichever keys
// arrive as note messages on its two navigation channels, left-hand 3 and right-hand
// 4 out of the box. Requires "MIDI In Navigate = Listen" on the instrument.
//
// Yamaha's Light Guide (EZ-300, EZ-310) works the same way through two "Light Part"
// channels, 1 and 2 by default.
const DEFAULTS: Record<LightProfileId, LightChannels> = {
    casio: { left: 3, right: 4 },
    yamaha: { left: 2, right: 1 },
    custom: { left: 1, right: 2 },
};

export function defaultChannels(profile: LightProfileId): LightChannels {
    return DEFAULTS[profile];
}

export function isChannel(value: number): boolean {
    return Number.isInteger(value) && value >= MIN_CHANNEL && value <= MAX_CHANNEL;
}

export function cleanChannel(value: unknown, fallback: number): number {
    return typeof value === "number" && isChannel(value) ? value : fallback;
}

// Whether a MIDI output's name looks like an instrument this list covers. Names are a
// hint and never a gate: the player picks the profile, and a wrong guess costs nothing
// because the test button is right there. Matching on the name alone would claim
// lighting for every Casio ever made, most of which have no lights at all.
export function suggestProfile(deviceName: string): LightProfileId | null {
    const name = deviceName.toLowerCase();
    if (name.includes("casio") || /\blk-?s?\d/.test(name)) {
        return "casio";
    }
    if (name.includes("yamaha") || /\bez-?\d/.test(name)) {
        return "yamaha";
    }
    return null;
}
