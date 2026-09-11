// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pickPlural } from "../core/plural.ts";
import { stringsFor } from "./gen-known-ids.mts";

// Every build writes the edge's strings from the catalogue, so a message the edge cannot
// read stops the site build — and only the build, which no quick gate runs. Reading them
// here puts the same failure in the node project.
const { locales } = JSON.parse(readFileSync("project.inlang/settings.json", "utf8")) as {
    locales: string[];
};

describe("the edge's strings", () => {
    it.each(locales)("load for %s", (locale) => {
        const strings = stringsFor(locale);
        expect(strings.playFacts.other).toContain("{bars}");
        for (const [key, value] of Object.entries(strings)) {
            if (key !== "playFacts") {
                expect(value, key).not.toBe("");
            }
        }
    });

    it("carry the facts line's plural forms", () => {
        const en = stringsFor("en").playFacts;
        expect(pickPlural(en, "en", 1)).toContain("{bars} bar,");
        expect(pickPlural(en, "en", 22)).toContain("{bars} bars,");
        const pl = stringsFor("pl").playFacts;
        expect(pickPlural(pl, "pl", 3)).not.toBe(pickPlural(pl, "pl", 5));
    });
});
