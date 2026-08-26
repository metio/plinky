// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { releaseTail, ringTail, sustainRing, webAudioEngine } from "./webAudioEngine";

// Smoke the real Web Audio path under a browser: the engine opens its shared
// context and the synthesis graphs build without throwing. What the strikes
// SHOULD be is the hooks' business, tested against the fake engine.
describe("webAudioEngine", () => {
    it("has an audio clock", () => {
        expect(webAudioEngine.now()).not.toBeNull();
    });

    it("builds a strike and a click without throwing", () => {
        expect(() => {
            webAudioEngine.resume();
            webAudioEngine.strike({ note: 60, gain: 0.2, velocity: 90, duration: 0.2, delay: 0 });
            webAudioEngine.click((webAudioEngine.now() ?? 0) + 0.05, "accent", 0.2);
        }).not.toThrow();
    });

    it("presses, releases and pedals live voices without throwing", () => {
        expect(() => {
            webAudioEngine.resume();
            // Press, re-press (replaces), release under the pedal (held), then lift it.
            webAudioEngine.press(64, 0.2, 90);
            webAudioEngine.press(64, 0.2, 90);
            webAudioEngine.setPedal("sustain", true);
            webAudioEngine.release(64); // held by the pedal, not ended
            webAudioEngine.setPedal("sustain", false); // now ended
            // The other two pedals build and tear down cleanly too.
            webAudioEngine.press(67, 0.2, 90);
            webAudioEngine.setPedal("sostenuto", true);
            webAudioEngine.release(67); // held by sostenuto's snapshot
            webAudioEngine.setPedal("soft", true);
            webAudioEngine.press(69, 0.2, 90); // struck softly
            webAudioEngine.setPedal("soft", false);
            webAudioEngine.setPedal("sostenuto", false);
            // A release for a note that never pressed is a harmless no-op.
            webAudioEngine.release(99);
            // A generous release (an imprecise input's tap let ring) schedules a longer
            // envelope without throwing.
            webAudioEngine.press(72, 0.2, 90);
            webAudioEngine.release(72, 1.8);
        }).not.toThrow();
    });

    it("unlocks — resumes and primes a silent buffer — without throwing", () => {
        expect(() => {
            webAudioEngine.unlock();
            // A second call must be a cheap no-op on the priming, not a throw.
            webAudioEngine.unlock();
        }).not.toThrow();
    });

    it("declares a playback audio session where the browser exposes one", () => {
        webAudioEngine.unlock();
        // WebKit-only (iOS 16.4+); Chromium and Firefox have no audioSession, and
        // there the assertion simply does not run — the unlock above still must not
        // have thrown, which is the cross-engine guarantee.
        const session = (navigator as unknown as { audioSession?: { type?: string } }).audioSession;
        if (session) {
            expect(session.type).toBe("playback");
        }
    });

    it("silences a strike scheduled ahead when all notes are turned off", () => {
        // A fixed-length strike opens no live voice, so allNotesOff must reach it through the
        // scheduled-strike tracking — otherwise a note scheduled seconds ahead by its delay
        // (an ear-training question's later notes) rings on past a panic or a page change.
        expect(() => {
            webAudioEngine.resume();
            webAudioEngine.strike({ note: 60, gain: 0.2, velocity: 90, duration: 0.5, delay: 2 });
            webAudioEngine.allNotesOff();
            // A second panic with nothing pending is a clean no-op.
            webAudioEngine.allNotesOff();
        }).not.toThrow();
    });

    it("ignores a zero-gain strike instead of feeding it to a ramp", () => {
        // An exponential ramp to 0 is a RangeError; the engine must drop it.
        expect(() =>
            webAudioEngine.strike({ note: 60, gain: 0, velocity: 90, duration: 0.2, delay: 0 }),
        ).not.toThrow();
    });

    it("rings a held note out over seconds, not forever, and not a release tail", () => {
        // What a string does when nothing stops it: the energy the hammer put in leaves as
        // sound and then there is none left. A note held under the pedal used to sound at a
        // constant level for as long as the page stayed open.
        //
        // The lengths are measured off the recorded instrument, which already behaves this
        // way because its recording simply runs out: A2 rings just under 16 seconds and A6
        // just under 7. The two instruments have to agree, or one goes on after the other
        // has stopped.
        expect(sustainRing(110)).toBeCloseTo(16, 0);
        expect(sustainRing(1760)).toBeCloseTo(7, 0);
        // Far longer than the tail a released key gets — a pedalled note is not a released
        // one that happens to ring a bit more.
        expect(sustainRing(262)).toBeGreaterThan(releaseTail(262) * 10);
    });

    it("rings a low held note longer than a high one, and clamps past the endpoints", () => {
        expect(sustainRing(110)).toBeGreaterThan(sustainRing(440));
        expect(sustainRing(440)).toBeGreaterThan(sustainRing(1760));
        // Below A2 and above A6 the interpolation stops rather than running away: the
        // deepest bass rings A2's length and the top treble A6's, both finite.
        expect(sustainRing(27.5)).toBe(sustainRing(110));
        expect(sustainRing(4186)).toBe(sustainRing(1760));
        expect(Number.isFinite(sustainRing(1))).toBe(true);
    });

    it("caps a note's ring by its own length so short notes stay crisp", () => {
        const freq = 262; // ~C4
        // A held note rings its full register tail; a short/staccato note is clipped well
        // under it, and the very shortest still keeps a small click-free floor.
        expect(ringTail(freq, 2)).toBe(releaseTail(freq));
        expect(ringTail(freq, 0.1)).toBeLessThan(releaseTail(freq));
        expect(ringTail(freq, 0.1)).toBeLessThan(ringTail(freq, 1));
        expect(ringTail(freq, 0.001)).toBeGreaterThan(0);
    });

    it("rings a bass note out longer than a treble note", () => {
        // The release tail scales with register — low strings sustain far longer than
        // high ones — and is clamped past the ~A2..~A6 endpoints.
        expect(releaseTail(110)).toBeGreaterThan(releaseTail(1760));
        expect(releaseTail(220)).toBeGreaterThan(releaseTail(880));
        // Clamped: nothing rings longer than the bass floor or shorter than the treble cap.
        expect(releaseTail(40)).toBeCloseTo(releaseTail(110));
        expect(releaseTail(4000)).toBeCloseTo(releaseTail(1760));
    });
});
