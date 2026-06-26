// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { links } from "./root";
import { overwriteGetLocale } from "./paraglide/runtime.js";

const hasFontPreload = () =>
    links().some((link) => "as" in link && link.as === "font" && link.rel === "preload");

afterEach(() => overwriteGetLocale(() => "en"));

describe("root links", () => {
    it("preloads the Latin font for a Latin-script locale", () => {
        overwriteGetLocale(() => "en");
        expect(hasFontPreload()).toBe(true);
        overwriteGetLocale(() => "de");
        expect(hasFontPreload()).toBe(true);
    });

    it("omits the Latin preload where the page's text comes from another subset", () => {
        // Cyrillic, Greek, and CJK pages paint their primary text from a different
        // Inter subset or a system font, so the Latin preload would only compete.
        for (const locale of ["ru", "uk", "sr", "el", "ja", "ko", "zh"] as const) {
            overwriteGetLocale(() => locale);
            expect(hasFontPreload()).toBe(false);
        }
    });
});
