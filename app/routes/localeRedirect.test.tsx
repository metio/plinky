// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { getLocaleForUrl, localStorageKey, strategy } from "../paraglide/runtime.js";

afterEach(() => {
    localStorage.clear();
});

// The bare "/" resolves the locale through the strategy chain, and the order of that
// chain is the behaviour a player feels. These drive `getLocaleForUrl` — the same
// resolution `getLocale` performs — because the shared test setup pins `getLocale`
// itself to the base locale for every suite, which would mask the thing under test.
describe("locale resolution at the bare root", () => {
    it("consults the stored choice before the browser's preference", () => {
        // Position is the contract: url must outrank the stored choice so a shared
        // /de/ link stays German for whoever opens it, and the stored choice must
        // outrank the browser so a returning player reopens in the language they picked.
        expect(strategy.indexOf("url")).toBeLessThan(strategy.indexOf("localStorage"));
        expect(strategy.indexOf("localStorage")).toBeLessThan(
            strategy.indexOf("preferredLanguage"),
        );
    });

    it("reopens in the language the player chose", () => {
        localStorage.setItem(localStorageKey, "de");
        expect(getLocaleForUrl("http://localhost:3000/")).toBe("de");
    });

    it("follows the browser when the player has chosen nothing yet", () => {
        // jsdom reports an English-preferring navigator, so a first-time visitor
        // resolves to English rather than throwing or dead-ending.
        expect(getLocaleForUrl("http://localhost:3000/")).toBe("en");
    });

    it("lets a localized link win over the stored choice, so a shared link is honest", () => {
        localStorage.setItem(localStorageKey, "de");
        expect(getLocaleForUrl("http://localhost:3000/fr/library")).toBe("fr");
    });
});
