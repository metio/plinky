// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { browserCookies } from "./browserCookie";

afterEach(() => {
    browserCookies.write("klimpi-test", "", 0);
    vi.restoreAllMocks();
});

describe("browserCookies", () => {
    it("writes a site-wide cookie the next read sees", () => {
        expect(browserCookies.write("klimpi-test", "de", 60)).toBe(true);
        expect(browserCookies.read()).toContain("klimpi-test=de");
    });

    it("scopes the cookie to the whole site and gives it the lifetime asked for", () => {
        // The read-back above cannot see attributes, and passes without path=/ on a page at
        // the root. Written from /de/music/ without it, the cookie would be scoped there,
        // and the edge answering the bare "/" would never be sent it.
        const written: string[] = [];
        vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
            written.push(value);
        });
        browserCookies.write("klimpi-test", "de", 60);
        expect(written).toEqual(["klimpi-test=de; path=/; max-age=60"]);
    });

    it("forgets a cookie written with no lifetime left", () => {
        browserCookies.write("klimpi-test", "de", 60);
        browserCookies.write("klimpi-test", "", 0);
        expect(browserCookies.read()).not.toContain("klimpi-test=");
    });

    it("answers empty and false where the page may not use cookies", () => {
        vi.spyOn(document, "cookie", "get").mockImplementation(() => {
            throw new DOMException("denied", "SecurityError");
        });
        vi.spyOn(document, "cookie", "set").mockImplementation(() => {
            throw new DOMException("denied", "SecurityError");
        });
        expect(browserCookies.read()).toBe("");
        expect(browserCookies.write("klimpi-test", "de", 60)).toBe(false);
    });
});
