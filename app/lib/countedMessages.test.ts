// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { m } from "../paraglide/messages.js";

// A message that takes a count agrees with it. The copy itself is what these assert, so
// they name it outright: a message with one plural shape reads "1 pieces" in English and
// "2 nut" in Polish, and neither mistake is visible from the call site.

describe("a counted message in English", () => {
    it.each([
        ["review_start", m.review_start({ count: 1 }), "▶ Review 1 piece"],
        ["review_start", m.review_start({ count: 2 }), "▶ Review 2 pieces"],
        ["today_review", m.today_review({ count: 1 }), "Refresh 1 piece"],
        ["today_review", m.today_review({ count: 3 }), "Refresh 3 pieces"],
        [
            "stats_opening_days",
            m.stats_opening_days({ days: 1 }),
            "You played on 1 day this month.",
        ],
        [
            "stats_opening_days",
            m.stats_opening_days({ days: 4 }),
            "You played on 4 days this month.",
        ],
        [
            "stats_opening_days_more",
            m.stats_opening_days_more({ days: 1, more: 1 }),
            "You played on 1 day this month, 1 more than last month.",
        ],
        [
            "repertoire_days_left",
            m.repertoire_days_left({ date: "2026-09-12", count: 1 }),
            "2026-09-12 — 1 day away",
        ],
        ["drill_leap_semitones", m.drill_leap_semitones({ count: 1 }), "1 semitone"],
        ["recap_best_day", m.recap_best_day({ count: 1 }), "Best day: 1 note"],
        ["recap_best_day", m.recap_best_day({ count: 640 }), "Best day: 640 notes"],
    ])("%s reads %s", (_key, rendered, expected) => {
        expect(rendered).toBe(expected);
    });
});

describe("a counted message in a language with more than two forms", () => {
    it("takes the Polish form for two to four and the one for five and up", () => {
        expect(m.recap_best_day({ count: 1 }, { locale: "pl" })).toBe("Najlepszy dzień: 1 nuta");
        expect(m.recap_best_day({ count: 3 }, { locale: "pl" })).toBe("Najlepszy dzień: 3 nuty");
        expect(m.recap_best_day({ count: 5 }, { locale: "pl" })).toBe("Najlepszy dzień: 5 nut");
    });

    it("takes the Russian form for twenty-one, which counts as one", () => {
        expect(m.drill_leap_semitones({ count: 21 }, { locale: "ru" })).toBe("21 полутон");
        expect(m.drill_leap_semitones({ count: 22 }, { locale: "ru" })).toBe("22 полутона");
        expect(m.drill_leap_semitones({ count: 25 }, { locale: "ru" })).toBe("25 полутонов");
    });
});

// Every plural message in every locale, at the counts where the arms change hands: zero,
// one, the few forms (2, 22), the many forms (5, 20, 101) and the twenty-one that Slavic
// languages count as one. A missing arm prints the message key and a dropped placeholder
// takes the number out of the sentence, so each rendering must be neither.
const locales: string[] = JSON.parse(readFileSync("project.inlang/settings.json", "utf8")).locales;
const contract: Record<string, unknown> = JSON.parse(readFileSync("messages/en.json", "utf8"));
type Declared = [{ declarations: string[]; selectors: string[] }];
const counted = Object.entries(contract)
    .filter((entry): entry is [string, Declared] => Array.isArray(entry[1]))
    .map(([key, [{ declarations, selectors }]]) => {
        const inputs = declarations
            .filter((line) => line.startsWith("input "))
            .map((line) => line.slice("input ".length));
        // "local countPlural = count: plural" — the input the arms are chosen by.
        const selector = declarations
            .find((line) => line.startsWith(`local ${selectors[0]} =`))
            ?.match(/= (\w+): plural/)?.[1];
        return { key, inputs, selector: selector ?? "" };
    });
const render = m as unknown as Record<
    string,
    (inputs: Record<string, unknown>, options: { locale: string }) => string
>;

describe("every plural message in every locale", () => {
    it("finds the plural messages and what each counts", () => {
        expect(counted.length).toBeGreaterThan(10);
        for (const { key, inputs, selector } of counted) {
            expect(inputs, key).toContain(selector);
        }
    });

    it.each(
        counted.flatMap(({ key, inputs, selector }) =>
            locales.map((locale) => ({ key, inputs, selector, locale })),
        ),
    )("$key in $locale reads its number at every count", ({ key, inputs, selector, locale }) => {
        for (const n of [0, 1, 2, 5, 20, 21, 22, 101]) {
            const values = Object.fromEntries(
                inputs.map((name) => [name, name === selector ? n : "‹x›"]),
            );
            const text = render[key]!(values, { locale });
            expect(text, `${key} ${locale} ${n}`).not.toBe(key);
            expect(text, `${key} ${locale} ${n}`).toContain(String(n));
        }
    });

    it("takes Romanian's 'de' from twenty up", () => {
        expect(m.progress_notes({ count: 19 }, { locale: "ro" })).toBe("19 note");
        expect(m.progress_notes({ count: 20 }, { locale: "ro" })).toBe("20 de note");
        expect(m.progress_notes({ count: 101 }, { locale: "ro" })).toBe("101 note");
    });

    it("counts a hundred days of playing with Romanian's 'de'", () => {
        expect(m.achievement_days({ count: 100 }, { locale: "ro" })).toBe("100 de zile de cântat");
        expect(m.achievement_days({ count: 10 }, { locale: "ro" })).toBe("10 zile de cântat");
    });

    it("counts days ago in Russian and Czech with their own forms", () => {
        expect(m.balance_last({ days: 21 }, { locale: "ru" })).toBe(
            "В последний раз 21 день назад",
        );
        expect(m.balance_last({ days: 3 }, { locale: "ru" })).toBe("В последний раз 3 дня назад");
        expect(m.balance_last({ days: 5 }, { locale: "ru" })).toBe("В последний раз 5 дней назад");
        expect(m.balance_last({ days: 1 }, { locale: "cs" })).toBe("Naposledy hráno před 1 dnem");
        expect(m.balance_last({ days: 5 }, { locale: "cs" })).toBe("Naposledy hráno před 5 dny");
    });

    it("tells Czech two from five", () => {
        expect(m.scores_count({ count: 2 }, { locale: "cs" })).toBe("2 skladby");
        expect(m.scores_count({ count: 5 }, { locale: "cs" })).toBe("5 skladeb");
    });

    it("tells Croatian and Serbian two from five", () => {
        expect(m.progress_notes({ count: 2 }, { locale: "hr" })).toBe("2 note");
        expect(m.progress_notes({ count: 5 }, { locale: "hr" })).toBe("5 nota");
        expect(m.progress_notes({ count: 2 }, { locale: "sr" })).toBe("2 ноте");
        expect(m.progress_notes({ count: 5 }, { locale: "sr" })).toBe("5 нота");
    });
});

describe("a count of zero", () => {
    // The catalogue is European Portuguese, where only 1 is singular; Brazilian Portuguese,
    // which a bare "pt" selects in CLDR, reads 0 as singular too.
    it("reads plural in European Portuguese", () => {
        expect(m.scores_count({ count: 0 }, { locale: "pt" })).toBe("0 partituras");
        expect(m.progress_notes({ count: 0 }, { locale: "pt" })).toMatch(/^0 notas$/);
        expect(m.scores_count({ count: 1 }, { locale: "pt" })).toBe("1 partitura");
    });

    it("stays singular in French, where zero takes the singular", () => {
        expect(m.scores_count({ count: 0 }, { locale: "fr" })).toBe("0 partition");
    });
});
