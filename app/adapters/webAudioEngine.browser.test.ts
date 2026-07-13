// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { releaseTail, webAudioEngine } from "./webAudioEngine";

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
