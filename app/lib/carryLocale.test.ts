// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { cookieMaxAge, cookieName, localStorageKey } from "../paraglide/runtime.js";
import type { CookieJar } from "../ports/cookieJar";
import { carryLocaleChoice } from "./carryLocale";

// A page's cookies as a map, with every write it was asked for recorded as written.
function memoryJar(seed: Record<string, string> = {}) {
    const held = new Map(Object.entries(seed));
    const writes: string[] = [];
    const jar: CookieJar = {
        read: () => [...held].map(([name, value]) => `${name}=${value}`).join("; "),
        write: (name, value, maxAgeSeconds) => {
            writes.push(`${name}=${value}; max-age=${maxAgeSeconds}`);
            held.set(name, value);
            return true;
        },
    };
    return { jar, held, writes };
}

describe("carryLocaleChoice", () => {
    it("copies a language kept only in localStorage into the cookie, as setLocale writes it", () => {
        const { jar, held, writes } = memoryJar({ theme: "dark" });
        carryLocaleChoice(jar, memoryStore({ [localStorageKey]: "de" }));
        expect(writes).toEqual([`${cookieName}=de; max-age=${cookieMaxAge}`]);
        expect(held.get(cookieName)).toBe("de");
    });

    it("leaves a cookie that already names a language as it is", () => {
        const { jar, writes } = memoryJar({ theme: "dark", [cookieName]: "pt" });
        carryLocaleChoice(jar, memoryStore({ [localStorageKey]: "de" }));
        expect(writes).toEqual([]);
    });

    it("writes nothing when localStorage holds no language", () => {
        const { jar, writes } = memoryJar();
        carryLocaleChoice(jar, memoryStore());
        carryLocaleChoice(jar, memoryStore({ [localStorageKey]: "xx" }));
        expect(writes).toEqual([]);
    });

    it("carries once, and has nothing to carry on the next load", () => {
        const { jar, writes } = memoryJar();
        const store = memoryStore({ [localStorageKey]: "de" });
        carryLocaleChoice(jar, store);
        carryLocaleChoice(jar, store);
        expect(writes).toHaveLength(1);
    });
});
