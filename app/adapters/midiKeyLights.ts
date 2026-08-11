// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { diffLights, type LitKeys, NOTHING_LIT } from "../../core/keyLights";
import type { LightChannels } from "../../core/lightProfile";
import type { KeyLightsPort } from "../ports/keyLights";

// Lit keys as MIDI. Casio's MIDI In Navigate and Yamaha's Light Guide both light
// whichever keys arrive as note messages on their navigation channels, so this is
// plain note-on and note-off — no SysEx, and therefore no second permission prompt.
//
// The adapter owns the picture currently on the instrument and sends only the
// difference. That is what keeps a redundant note-on from ever being generated (so the
// instrument never has to decide what a second one means) and guarantees an off for
// every on.

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

// Full velocity: on an instrument that maps velocity to brightness this is the
// brightest, and on one that ignores it it is the value every manual uses.
const LIT_VELOCITY = 127;

function message(status: number, channel: number, note: number, velocity: number): number[] {
    // Channels read 1..16 and travel 0..15.
    return [status | ((channel - 1) & 0x0f), note & 0x7f, velocity];
}

export function createMidiKeyLights(
    // Where the bytes go. A function rather than the output itself, so the caller can
    // switch devices, drop to nothing when no output is chosen, and swallow its own
    // send errors — lighting is decoration and must never be able to stop the music.
    send: (data: number[]) => void,
    // Read fresh on every send: the player can change either channel in Settings
    // mid-session, and a profile captured at construction would keep lighting the old
    // one until a reload.
    channels: () => LightChannels,
): KeyLightsPort {
    let shown: LitKeys = NOTHING_LIT;

    const emit = (keys: LitKeys, status: number, velocity: number) => {
        const { left, right } = channels();
        for (const note of keys.left) {
            send(message(status, left, note, velocity));
        }
        for (const note of keys.right) {
            send(message(status, right, note, velocity));
        }
    };

    return {
        show(keys) {
            const change = diffLights(shown, keys);
            // Off before on: a key moving from one hand's channel to the other must be
            // extinguished on the old channel first, or the instrument is left holding
            // a light nothing will ever take back.
            emit(change.off, NOTE_OFF, 0);
            emit(change.on, NOTE_ON, LIT_VELOCITY);
            shown = keys;
        },
        clear() {
            emit(shown, NOTE_OFF, 0);
            shown = NOTHING_LIT;
        },
    };
}
