// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { singularCopies } from "./singular-copies.mjs";

const plural = (match: Record<string, string>) => [
    {
        declarations: ["input count", "local countPlural = count: plural"],
        selectors: ["countPlural"],
        match,
    },
];

describe("singularCopies", () => {
    it("flags a singular copied from the plural in a language that tells them apart", () => {
        const problems = singularCopies("de", {
            progress_notes_one: "{count} Noten",
            progress_notes_other: "{count} Noten",
        });
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^progress_notes:/);
    });

    it("leaves a real singular alone", () => {
        expect(
            singularCopies("de", {
                progress_notes_one: "{count} Note",
                progress_notes_other: "{count} Noten",
            }),
        ).toEqual([]);
    });

    it("flags a plural message whose every arm reads the same", () => {
        const problems = singularCopies("fr", {
            scores_count: plural({
                "countPlural=one": "{count} partitions",
                "countPlural=many": "{count} partitions",
                "countPlural=other": "{count} partitions",
            }),
        });
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^scores_count:/);
    });

    it("accepts a message whose forms part only after one", () => {
        // Croatian: 1 nota, 2 note, 5 nota. The singular matches the plural and is right.
        expect(
            singularCopies("hr", {
                progress_notes: plural({
                    "countPlural=one": "{count} nota",
                    "countPlural=few": "{count} note",
                    "countPlural=other": "{count} nota",
                }),
            }),
        ).toEqual([]);
    });

    it("flags a singular copied from the genitive plural while the few arm differs", () => {
        const problems = singularCopies("pl", {
            progress_notes: plural({
                "countPlural=one": "{count} nut",
                "countPlural=few": "{count} nuty",
                "countPlural=many": "{count} nut",
                "countPlural=other": "{count} nut",
            }),
        });
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^progress_notes:/);
    });

    // Each language's real forms, and the arm its singular must never read like.
    const FORMS: [string, string, Record<string, string>][] = [
        [
            "ru",
            "many",
            {
                one: "{count} нота",
                few: "{count} ноты",
                many: "{count} нот",
                other: "{count} ноты",
            },
        ],
        [
            "uk",
            "many",
            {
                one: "{count} нота",
                few: "{count} ноти",
                many: "{count} нот",
                other: "{count} ноти",
            },
        ],
        [
            "cs",
            "other",
            {
                one: "{count} nota",
                few: "{count} noty",
                many: "{count} noty",
                other: "{count} not",
            },
        ],
        [
            "sk",
            "other",
            {
                one: "{count} nota",
                few: "{count} noty",
                many: "{count} noty",
                other: "{count} nôt",
            },
        ],
        ["hr", "few", { one: "{count} nota", few: "{count} note", other: "{count} nota" }],
        ["sr", "few", { one: "{count} нота", few: "{count} ноте", other: "{count} нота" }],
        ["ro", "few", { one: "{count} notă", few: "{count} note", other: "{count} de note" }],
    ];
    const asPlural = (forms: Record<string, string>) =>
        plural(
            Object.fromEntries(
                Object.entries(forms).map(([category, text]) => [`countPlural=${category}`, text]),
            ),
        );

    it.each(FORMS)(
        "in %s, passes real forms and flags a singular copied from %s",
        (locale, apart, forms) => {
            const copied = { ...forms, one: forms[apart]! };
            expect(singularCopies(locale, { progress_notes: asPlural(forms) }, {})).toEqual([]);
            expect(singularCopies(locale, { progress_notes: asPlural(copied) }, {})).toHaveLength(
                1,
            );
        },
    );

    it("asks nothing of a language with one form for every count", () => {
        expect(
            singularCopies("ja", {
                progress_notes_one: "{count}音符",
                progress_notes_other: "{count}音符",
            }),
        ).toEqual([]);
    });

    it("asks nothing of a language whose numerals take the singular", () => {
        expect(
            singularCopies("hu", {
                progress_notes_one: "{count} hang",
                progress_notes_other: "{count} hang",
            }),
        ).toEqual([]);
    });

    it("excuses a listed word, and reports the listing once the word no longer needs it", () => {
        const exemptions = { sq: { today_stand: "pjesë is one word for one and several" } };
        const invariant = {
            today_stand_one: "{count} pjesë",
            today_stand_other: "{count} pjesë",
        };
        expect(singularCopies("sq", invariant, exemptions)).toEqual([]);

        expect(
            singularCopies(
                "sq",
                { today_stand_one: "{count} copa", today_stand_other: "{count} copë" },
                exemptions,
            ),
        ).toHaveLength(1);
        expect(singularCopies("sq", {}, exemptions)[0]).toMatch(/no longer does/);
    });

    it("finds no copied singular anywhere in the catalogue", () => {
        const { locales } = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
        const found = (locales as string[]).flatMap((locale) =>
            singularCopies(locale, JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"))).map(
                (problem) => `${locale} ${problem}`,
            ),
        );
        expect(found).toEqual([]);
    });
});
