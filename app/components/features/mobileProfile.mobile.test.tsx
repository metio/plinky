// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";

// A guard on the profile itself: the whole point of the browser-mobile project is that the
// phone viewport, coarse pointer and touch are genuinely in effect inside the test's own
// window. If any of these fails, the mobile suite is silently running as desktop and every
// "mobile" pass below is meaningless — so pin the environment before trusting any test.
describe("mobile profile", () => {
    it("reports a phone-width viewport", () => {
        expect(window.innerWidth).toBeLessThanOrEqual(430);
    });

    it("reports a coarse pointer (touch)", () => {
        expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);
    });

    it("exposes touch points", () => {
        expect(navigator.maxTouchPoints).toBeGreaterThan(0);
    });

    it("reports portrait orientation", () => {
        expect(window.matchMedia("(orientation: portrait)").matches).toBe(true);
    });
});
