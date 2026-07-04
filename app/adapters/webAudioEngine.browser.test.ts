// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { webAudioEngine } from "./webAudioEngine";

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

    it("ignores a zero-gain strike instead of feeding it to a ramp", () => {
        // An exponential ramp to 0 is a RangeError; the engine must drop it.
        expect(() =>
            webAudioEngine.strike({ note: 60, gain: 0, duration: 0.2, delay: 0 }),
        ).not.toThrow();
    });
});
