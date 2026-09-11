// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pickPlural, pluralForms, pluralRulesLocale } from "./plural";

const EN = { one: "{bars} bar", other: "{bars} bars" };
const PL = {
    one: "{bars} takt",
    few: "{bars} takty",
    many: "{bars} taktów",
    other: "{bars} taktu",
};

describe("pickPlural", () => {
    it("reads one as one and everything else as other in English", () => {
        expect(pickPlural(EN, "en", 1)).toBe("{bars} bar");
        expect(pickPlural(EN, "en", 0)).toBe("{bars} bars");
        expect(pickPlural(EN, "en", 22)).toBe("{bars} bars");
    });

    it("chooses among a Slavic language's few and many", () => {
        expect(pickPlural(PL, "pl", 1)).toBe("{bars} takt");
        expect(pickPlural(PL, "pl", 3)).toBe("{bars} takty");
        expect(pickPlural(PL, "pl", 22)).toBe("{bars} takty");
        expect(pickPlural(PL, "pl", 5)).toBe("{bars} taktów");
        expect(pickPlural(PL, "pl", 12)).toBe("{bars} taktów");
    });

    it("counts zero as plural in European Portuguese", () => {
        const forms = { one: "{n} singular", other: "{n} plural" };
        expect(pickPlural(forms, "pt", 0)).toBe("{n} plural");
        expect(pickPlural(forms, "pt", 1)).toBe("{n} singular");
    });

    it("falls back to other when a language's category has no form", () => {
        expect(pickPlural({ other: "{n} Takte" }, "de", 1)).toBe("{n} Takte");
    });

    it("always answers with one of the forms it was given", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("en", "de", "pl", "ru", "cs", "pt", "ja", "fr"),
                fc.nat(10_000),
                (locale, count) => {
                    expect(Object.values(PL)).toContain(pickPlural(PL, locale, count));
                },
            ),
        );
    });
});

describe("pluralRulesLocale", () => {
    it("points Portuguese at the European rules and leaves every other tag alone", () => {
        expect(pluralRulesLocale("pt")).toBe("pt-PT");
        expect(pluralRulesLocale("pl")).toBe("pl");
        expect(pluralRulesLocale("en")).toBe("en");
    });
});

describe("pluralForms", () => {
    const entry = (match: Record<string, string>, selectors = ["barsPlural"]) => [
        { declarations: ["input bars", "local barsPlural = bars: plural"], selectors, match },
    ];

    it("reads a plain string as the one form every count shares", () => {
        expect(pluralForms("Grade {grade}")).toEqual({ other: "Grade {grade}" });
    });

    it("reads a plural entry's arms by category", () => {
        expect(
            pluralForms(
                entry({ "barsPlural=one": "{bars} bar", "barsPlural=other": "{bars} bars" }),
            ),
        ).toEqual(EN);
    });

    it("refuses what has no single count to choose by or nothing to fall back to", () => {
        expect(pluralForms("")).toBeNull();
        expect(pluralForms(undefined)).toBeNull();
        expect(pluralForms(entry({ "barsPlural=one": "{bars} bar" }))).toBeNull();
        expect(pluralForms(entry({ "a=one": "x", "b=other": "y" }, ["a", "b"]))).toBeNull();
        expect(pluralForms(entry({ "other=other": "x" }))).toBeNull();
        expect(pluralForms([])).toBeNull();
    });
});
