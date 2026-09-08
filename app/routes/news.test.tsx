// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { overwriteGetLocale } from "../paraglide/runtime.js";
import { links } from "./news";

afterEach(() => {
    overwriteGetLocale(() => "en");
});

const preloadedFont = (): string | null => {
    const found = links().find((link) => "as" in link && link.as === "font");
    return found && "href" in found ? String(found.href) : null;
};

// The changelog is one English document shown on twenty-six localised pages, so this page
// draws its body text from the Latin subset whatever its chrome is in. A page that does
// not ask for that subset gets it from the stylesheet instead, paints in a fallback and
// re-lays itself out — which on a page of dense prose is a whole viewport of movement, and
// is what failed the layout-shift budget on the Greek run at 0.157 against 0.1.

describe("the font this page asks for", () => {
    it("asks for the Latin subset where the interface is in another script", () => {
        for (const locale of ["el", "ru", "uk", "sr"] as const) {
            overwriteGetLocale(() => locale);
            expect(preloadedFont()).toMatch(/latin/);
        }
    });

    it("asks for it where the reader's own system fonts draw the interface", () => {
        // A CJK page preloads no interface font, and the entries are still English.
        for (const locale of ["ja", "ko", "zh"] as const) {
            overwriteGetLocale(() => locale);
            expect(preloadedFont()).toMatch(/latin/);
        }
    });

    it("asks for nothing extra where the root already preloads Latin", () => {
        for (const locale of ["en", "de", "pl"] as const) {
            overwriteGetLocale(() => locale);
            expect(links()).toEqual([]);
        }
    });
});
