// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAudioContext } from "../testing/fakeAudioContext";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

// The engine holds one shared context, so each test gets a fresh module with a fresh fake
// under it — otherwise the second test counts the first one's voices.
const engineWith = async (fake: ReturnType<typeof fakeAudioContext>) => {
    // A named function expression, not a class and not an arrow: `new` on it yields the
    // returned object, a class constructor may not return one, and an arrow cannot be
    // constructed at all — which the formatter will collapse it into if it is anonymous.
    const FakeContext = function FakeContext() {
        return fake.context as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    vi.stubGlobal("AudioContext", FakeContext);
    vi.resetModules();
    const { webAudioEngine } = await import("./webAudioEngine");
    return webAudioEngine;
};

describe("the sostenuto pedal", () => {
    it("leaves nothing ringing when it is pressed twice", async () => {
        // The defect this pins: a second press re-snapshotted the held set, and any note
        // leaving it whose key was already up was dropped without ever being ended. A
        // synthesised voice schedules no stop of its own, so it sounded on indefinitely.
        // Pedal-downs are not deduplicated — a half-pedal ramp sends several.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.press(60, 0.3, 90);
        engine.setPedal("sostenuto", true);
        engine.release(60);
        engine.press(62, 0.3, 90);
        engine.setPedal("sostenuto", true);
        engine.release(62);
        engine.setPedal("sostenuto", false);

        expect(fake.started()).toBeGreaterThan(0);
        expect(fake.live()).toBe(0);
    });

    it("still holds a captured note while the pedal is down", async () => {
        // The other half: the fix must not end notes the pedal is legitimately holding.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.press(60, 0.3, 90);
        engine.setPedal("sostenuto", true);
        engine.release(60);

        expect(fake.live()).toBeGreaterThan(0);
    });
});
