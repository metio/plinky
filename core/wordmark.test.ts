// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DOMAIN, TRACKING, WORDMARK, wordmarkText } from "./wordmark";

describe("wordmarkText", () => {
    it("is the name, with the domain as its own tail when asked", () => {
        expect(wordmarkText(false)).toBe(WORDMARK);
        expect(wordmarkText(true)).toBe(`${WORDMARK}${DOMAIN}`);
        expect(wordmarkText(true)).toBe("Plinky.fun");
    });
});

describe("the tracking", () => {
    it("opens the name up on a dark ground and leaves it as set on a light one", () => {
        expect(TRACKING.light).toBe(0);
        expect(TRACKING.dark).toBeGreaterThan(TRACKING.light);
    });
});
