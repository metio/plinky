// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { releaseTail, ringTail, webAudioEngine } from "./webAudioEngine";

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
            webAudioEngine.strike({ note: 60, gain: 0.2, duration: 0.2, delay: 0 });
            webAudioEngine.click((webAudioEngine.now() ?? 0) + 0.05, "accent", 0.2);
        }).not.toThrow();
    });

    it("presses, releases and pedals live voices without throwing", () => {
        expect(() => {
            webAudioEngine.resume();
            // Press, re-press (replaces), release under the pedal (held), then lift it.
            webAudioEngine.press(64, 0.2);
            webAudioEngine.press(64, 0.2);
            webAudioEngine.setPedal(true);
            webAudioEngine.release(64); // held by the pedal, not ended
            webAudioEngine.setPedal(false); // now ended
            // A release for a note that never pressed is a harmless no-op.
            webAudioEngine.release(99);
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

    it("ignores a zero-gain strike instead of feeding it to a ramp", () => {
        // An exponential ramp to 0 is a RangeError; the engine must drop it.
        expect(() =>
            webAudioEngine.strike({ note: 60, gain: 0, duration: 0.2, delay: 0 }),
        ).not.toThrow();
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
