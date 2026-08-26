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
        //
        // Asked as "is it still sounding a second from now" rather than "was it never
        // stopped". Every held voice schedules its own far-off end, so never-stopped no
        // longer separates a note ringing under the pedal from one that has been let go.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.press(60, 0.3, 90);
        engine.setPedal("sostenuto", true);
        engine.release(60);

        expect(fake.ringingAt(1)).toBeGreaterThan(0);
    });
});

describe("a note left under the sustain pedal", () => {
    it("falls silent on its own, with the pedal still down", async () => {
        // Reported from a real piano over USB MIDI: hold the damper pedal too long — which
        // is an ordinary mistake, not an exotic one — and a note sounded on and on. The
        // synthesised voice held its shelf and scheduled no end, so nothing was ever going
        // to stop it: not the key, which was up, and not the pedal, which was down. A
        // string does not behave that way, and the detuned partials made the stuck tone
        // beat against itself, heard as a slow wobble in pitch.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.setPedal("sustain", true);
        engine.press(60, 0.3, 90);
        engine.release(60);

        // Every oscillator carries its own end, so the voice dies whether or not anybody
        // lifts the pedal — and it is quiet within a minute, the way a string is.
        expect(fake.started()).toBeGreaterThan(0);
        expect(fake.live()).toBe(0);
        expect(fake.ringingAt(60)).toBe(0);
    });

    it("falls silent on its own under a held key too", async () => {
        // The same defect reached through the other holder: a key pressed and never
        // released rang exactly as long.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.press(60, 0.3, 90);

        expect(fake.live()).toBe(0);
        expect(fake.ringingAt(60)).toBe(0);
    });

    it("keeps ringing for now, rather than being cut short by its own end", async () => {
        // Scheduling an end must not end it early. A pedalled note is still sounding a
        // second later; a real piano would be, and the whole point of the pedal is that it
        // does not stop the note.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.setPedal("sustain", true);
        engine.press(60, 0.3, 90);
        engine.release(60);

        expect(fake.ringingAt(1)).toBeGreaterThan(0);
    });

    it("rings low notes longer than high ones, as strings do", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.setPedal("sustain", true);
        engine.press(36, 0.3, 90); // two octaves below middle C
        const lowStillRinging = fake.ringingAt(9);
        engine.press(96, 0.3, 90); // two octaves above
        const bothAt9 = fake.ringingAt(9);

        // The low note is still going at nine seconds; the high one is not, so adding it
        // added nothing to the count.
        expect(lowStillRinging).toBeGreaterThan(0);
        expect(bothAt9).toBe(lowStillRinging);
    });

    it("lifting the pedal still ends a note that is ringing", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();

        engine.setPedal("sustain", true);
        engine.press(60, 0.3, 90);
        engine.release(60);
        engine.setPedal("sustain", false);

        // Rung out over its release tail, not left to its own long decay.
        expect(fake.ringingAt(2)).toBe(0);
    });
});
