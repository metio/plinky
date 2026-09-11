// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
