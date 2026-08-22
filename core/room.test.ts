// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { ROOM_SECONDS, ROOM_WET, roomImpulse, wetFor } from "./room";

const energyOf = (samples: Float32Array): number =>
    samples.reduce((sum, sample) => sum + sample * sample, 0);

// The loudest sample in a window, which is how the tail's decay is read without asserting
// on individual noise values.
const peakBetween = (samples: Float32Array, from: number, to: number): number => {
    let peak = 0;
    for (let index = from; index < Math.min(to, samples.length); index++) {
        peak = Math.max(peak, Math.abs(samples[index] as number));
    }
    return peak;
};

describe("roomImpulse", () => {
    it("is the same room every time", () => {
        // The reason the generator is seeded at all: two renders of one take must sound
        // alike, and an exported video must sound like the app it came from. Ambient
        // randomness would give every export its own slightly different space.
        expect([...roomImpulse(48000, 1)]).toEqual([...roomImpulse(48000, 1)]);
    });

    it("gives the two ears different noise, so the room has sides", () => {
        // Identical channels are a room with no width. The channels differ by seed alone.
        const left = roomImpulse(48000, 1);
        const right = roomImpulse(48000, 2);
        expect([...left]).not.toEqual([...right]);
        expect(left.length).toBe(right.length);
    });

    it("lasts the tail's length at whatever rate the context runs", () => {
        // A video export renders at its own sample rate, and must get the same ROOM — not
        // the same array of numbers played at the wrong speed.
        for (const rate of [22050, 44100, 48000]) {
            expect(roomImpulse(rate, 1).length).toBe(Math.round(rate * ROOM_SECONDS));
        }
    });

    it("decays to silence rather than stopping", () => {
        // A tail cut off mid-ring is a click at the end of every note. Read as peaks over
        // windows, since individual noise samples say nothing.
        const impulse = roomImpulse(48000, 1);
        const start = peakBetween(impulse, 0, 4800);
        const middle = peakBetween(impulse, impulse.length / 2, impulse.length / 2 + 4800);
        const end = peakBetween(impulse, impulse.length - 4800, impulse.length);
        expect(middle).toBeLessThan(start);
        expect(end).toBeLessThan(middle);
        expect(end).toBeLessThan(start / 100);
    });

    it("carries the same energy whatever the rate, so one wet level fits every context", () => {
        // Unit energy is what lets the mix be tuned once. Without it a longer or denser
        // response is simply a louder one, and the export would be wetter than the app.
        for (const rate of [22050, 44100, 48000]) {
            expect(energyOf(roomImpulse(rate, 1))).toBeCloseTo(1, 5);
        }
    });

    it("puts the walls in before the tail has fallen far", () => {
        // The early reflections are what make it a room rather than a cathedral, so they
        // have to stand above the noise around them.
        const impulse = roomImpulse(48000, 1);
        const walls = peakBetween(impulse, 0, Math.round(0.05 * 48000));
        const after = peakBetween(impulse, Math.round(0.06 * 48000), Math.round(0.11 * 48000));
        expect(walls).toBeGreaterThan(after * 2);
    });

    it("holds together at an absurd rate rather than producing nothing", () => {
        // Guarding the arithmetic, not a real context: length must never round to zero.
        expect(roomImpulse(1, 1).length).toBeGreaterThan(0);
        expect(Number.isFinite(energyOf(roomImpulse(1, 1)))).toBe(true);
    });

    it("never asks a converter to swallow a sample past full scale", () => {
        const impulse = roomImpulse(48000, 1);
        expect(peakBetween(impulse, 0, impulse.length)).toBeLessThanOrEqual(1);
    });
});

describe("wetFor", () => {
    it("gives the room as designed at the top of the scale, and nothing at the bottom", () => {
        expect(wetFor(100)).toBe(ROOM_WET);
        expect(wetFor(0)).toBe(0);
    });

    it("scales in between", () => {
        expect(wetFor(50)).toBeCloseTo(ROOM_WET / 2);
    });

    it("never lets the room be louder than the piano standing in it", () => {
        // A stored setting can be anything — an older shape, something written by hand —
        // and that is the one failure that would actually hurt.
        for (const stored of [400, Number.POSITIVE_INFINITY, Number.NaN, -20]) {
            const wet = wetFor(stored);
            expect(Number.isFinite(wet)).toBe(true);
            expect(wet).toBeGreaterThanOrEqual(0);
            expect(wet).toBeLessThanOrEqual(ROOM_WET);
        }
    });

    it("treats an unreadable setting as the room as designed, not as silence", () => {
        // Dry is a deliberate choice somebody makes, so it should not be what a corrupt
        // value falls back to.
        expect(wetFor(Number.NaN)).toBe(ROOM_WET);
    });
});
