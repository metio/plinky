// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { audibleGain, FULL_VELOCITY, NOTE_CEILING, noteGain } from "./loudness";

const on = { sound: true, volume: 100 };

describe("audibleGain", () => {
    it("scales what the caller asked for by the volume the player set", () => {
        expect(audibleGain(on, 0.3)).toBeCloseTo(0.3);
        expect(audibleGain({ sound: true, volume: 50 }, 0.3)).toBeCloseTo(0.15);
    });

    it("answers nothing rather than silence when there is nothing to hear", () => {
        // Null, not 0: a caller must be able to drop the sound instead of scheduling it.
        // A strike at zero gain still runs the engine's ramps, and a click at zero gain
        // still occupies a slot on the audio clock that unmuting would not clear.
        expect(audibleGain({ sound: false, volume: 100 }, 0.3)).toBeNull();
        expect(audibleGain({ sound: true, volume: 0 }, 0.3)).toBeNull();
        expect(audibleGain(on, 0)).toBeNull();
    });

    it("refuses a volume outside the scale rather than amplifying it", () => {
        // A stored preference can be tampered with or left over from an older shape, and
        // the one failure mode that hurts is a sound played louder than the ceiling.
        expect(audibleGain({ sound: true, volume: 400 }, 0.3)).toBeCloseTo(0.3);
        expect(audibleGain({ sound: true, volume: -20 }, 0.3)).toBeNull();
        expect(audibleGain({ sound: true, volume: Number.NaN }, 0.3)).toBeNull();
    });
});

describe("noteGain", () => {
    it("plays a note at its velocity's share of the ceiling", () => {
        expect(noteGain(on, FULL_VELOCITY)).toBeCloseTo(NOTE_CEILING);
        expect(noteGain(on, FULL_VELOCITY / 2)).toBeCloseTo(NOTE_CEILING / 2);
    });

    it("keeps a struck note under the ceiling that leaves room for a chord", () => {
        // Several notes of a chord sum in the mix, so one note at full velocity must not
        // already be at the top.
        expect(noteGain(on, FULL_VELOCITY)).toBeLessThan(0.5);
    });

    it("stays silent when the player has the sound off, however hard the note", () => {
        expect(noteGain({ sound: false, volume: 100 }, FULL_VELOCITY)).toBeNull();
    });
});
