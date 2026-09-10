// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { browserCookies } from "./browserCookie";

afterEach(() => {
    browserCookies.write("plinky-test", "", 0);
    vi.restoreAllMocks();
});

describe("browserCookies", () => {
    it("writes a site-wide cookie the next read sees", () => {
        expect(browserCookies.write("plinky-test", "de", 60)).toBe(true);
        expect(browserCookies.read()).toContain("plinky-test=de");
    });

    it("forgets a cookie written with no lifetime left", () => {
        browserCookies.write("plinky-test", "de", 60);
        browserCookies.write("plinky-test", "", 0);
        expect(browserCookies.read()).not.toContain("plinky-test=");
    });

    it("answers empty and false where the page may not use cookies", () => {
        vi.spyOn(document, "cookie", "get").mockImplementation(() => {
            throw new DOMException("denied", "SecurityError");
        });
        vi.spyOn(document, "cookie", "set").mockImplementation(() => {
            throw new DOMException("denied", "SecurityError");
        });
        expect(browserCookies.read()).toBe("");
        expect(browserCookies.write("plinky-test", "de", 60)).toBe(false);
    });
});
