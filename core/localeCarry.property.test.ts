// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cookieValue, localeToCarry } from "./localeCarry";

const LOCALES = ["en", "de", "pt", "zh"];
const NAME = "PARAGLIDE_LOCALE";

// A Cookie header of unrelated cookies, the locale cookie among them or not.
const otherCookie = fc
    .tuple(fc.constantFrom("theme", "a", "session", "X"), fc.constantFrom("1", "dark", "de", ""))
    .map(([name, value]) => `${name}=${value}`);
const localeCookie = fc.constantFrom("en", "de", "xx", "", "pt").map((value) => `${NAME}=${value}`);
const header = fc
    .tuple(fc.array(otherCookie, { maxLength: 4 }), fc.option(localeCookie), fc.nat())
    .map(([others, own, at]) => {
        const parts = [...others];
        if (own !== null) {
            parts.splice(at % (parts.length + 1), 0, own);
        }
        return parts.join("; ");
    });
const stored = fc.option(fc.constantFrom("en", "de", "pt", "zh", "xx", ""));

describe("localeToCarry, whatever the cookies and the stored value", () => {
    it("writes only the stored choice, and only a language the site speaks", () => {
        fc.assert(
            fc.property(header, stored, (cookies, choice) => {
                const carried = localeToCarry(cookies, choice, LOCALES, NAME);
                if (carried !== null) {
                    expect(carried).toBe(choice);
                    expect(LOCALES).toContain(carried);
                }
            }),
        );
    });

    it("never overwrites a cookie that names a language", () => {
        fc.assert(
            fc.property(header, stored, (cookies, choice) => {
                const current = cookieValue(cookies, NAME);
                if (current !== null && LOCALES.includes(current)) {
                    expect(localeToCarry(cookies, choice, LOCALES, NAME)).toBeNull();
                }
            }),
        );
    });

    it("never changes the language the app shows, and leaves the cookie naming it", () => {
        // What the runtime shows from the two records: the cookie first, then localStorage.
        const shown = (cookies: string, choice: string | null) => {
            const cookie = cookieValue(cookies, NAME);
            if (cookie !== null && LOCALES.includes(cookie)) {
                return cookie;
            }
            return choice !== null && LOCALES.includes(choice) ? choice : null;
        };
        fc.assert(
            fc.property(header, stored, (cookies, choice) => {
                const carried = localeToCarry(cookies, choice, LOCALES, NAME);
                const after = carried === null ? cookies : `${NAME}=${carried}; ${cookies}`;
                const before = shown(cookies, choice);
                expect(shown(after, choice)).toBe(before);
                if (before !== null) {
                    expect(cookieValue(after, NAME)).toBe(before);
                }
            }),
        );
    });

    it("has nothing left to carry once it has been carried", () => {
        fc.assert(
            fc.property(header, stored, (cookies, choice) => {
                const carried = localeToCarry(cookies, choice, LOCALES, NAME);
                if (carried !== null) {
                    // The browser puts a written cookie ahead of the ones it already held.
                    const after = `${NAME}=${carried}; ${cookies}`;
                    expect(localeToCarry(after, choice, LOCALES, NAME)).toBeNull();
                }
            }),
        );
    });
});
