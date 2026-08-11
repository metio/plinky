// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Mastery, normalizeMastery, setDeadline } from "./mastery";
import { buildRepertoire, deadlineFor, orderRepertoire, stageOf } from "./repertoire";

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 5, 23, 12, 0).getTime();
const TODAY = "2026-06-23";

function mastery(overrides: Partial<Mastery> = {}): Mastery {
    return normalizeMastery({ learned: true, intervalDays: 1, reviewAt: NOW + DAY_MS, ...overrides });
}

describe("stageOf", () => {
    it("calls an unplayed or unlearned piece learning", () => {
        expect(stageOf(null)).toBe("learning");
        expect(stageOf(mastery({ learned: false }))).toBe("learning");
    });

    it("climbs the stages as the review interval widens", () => {
        expect(stageOf(mastery({ intervalDays: 1 }))).toBe("consolidating");
        expect(stageOf(mastery({ intervalDays: 6 }))).toBe("consolidating");
        expect(stageOf(mastery({ intervalDays: 7 }))).toBe("polishing");
        expect(stageOf(mastery({ intervalDays: 29 }))).toBe("polishing");
        expect(stageOf(mastery({ intervalDays: 30 }))).toBe("maintenance");
        expect(stageOf(mastery({ intervalDays: 180 }))).toBe("maintenance");
    });
});

describe("deadlineFor", () => {
    it("is absent for a piece with no date", () => {
        expect(deadlineFor("", TODAY)).toBeNull();
    });

    it("counts the days left, and says when the date has gone by", () => {
        expect(deadlineFor("2026-06-30", TODAY)).toEqual({
            date: "2026-06-30",
            daysLeft: 7,
            passed: false,
        });
        expect(deadlineFor("2026-06-20", TODAY)?.passed).toBe(true);
        expect(deadlineFor(TODAY, TODAY)).toEqual({ date: TODAY, daysLeft: 0, passed: false });
    });
});

describe("setDeadline", () => {
    it("sets and clears the date without disturbing the review schedule", () => {
        const dated = setDeadline(mastery(), "2026-07-04", NOW);
        expect(dated.deadline).toBe("2026-07-04");
        expect(dated.reviewAt).toBe(mastery().reviewAt);
        expect(setDeadline(dated, "", NOW).deadline).toBe("");
    });

    it("survives a round trip through the stored shape", () => {
        const dated = setDeadline(null, "2026-07-04", NOW);
        expect(normalizeMastery(JSON.parse(JSON.stringify(dated))).deadline).toBe("2026-07-04");
    });

    it("reads a stored entry from before deadlines existed as having none", () => {
        expect(normalizeMastery({ learned: true, intervalDays: 3 }).deadline).toBe("");
    });
});

describe("orderRepertoire", () => {
    const entry = (id: string, daysLeft: number | null, stage: "learning" | "maintenance") => ({
        item: { id },
        mastery: mastery(),
        stage,
        deadline: daysLeft === null ? null : { date: id, daysLeft, passed: daysLeft < 0 },
        slipping: false,
    });

    it("puts dated pieces first, soonest first", () => {
        const ordered = orderRepertoire([
            entry("later", 30, "maintenance"),
            entry("undated", null, "learning"),
            entry("soon", 2, "maintenance"),
        ]);
        expect(ordered.map((one) => one.item.id)).toEqual(["soon", "later", "undated"]);
    });

    it("orders the undated by stage, earliest stage first", () => {
        const ordered = orderRepertoire([
            entry("kept", null, "maintenance"),
            entry("new", null, "learning"),
        ]);
        expect(ordered.map((one) => one.item.id)).toEqual(["new", "kept"]);
    });
});

describe("buildRepertoire", () => {
    const items = [{ id: "played" }, { id: "untouched" }, { id: "dated" }, { id: "absent" }];
    const byId = new Map<string, Mastery>([
        ["played", mastery({ learned: false, bestScore: 62 })],
        ["untouched", mastery({ learned: false, bestScore: 0 })],
        ["dated", setDeadline(mastery({ learned: false, bestScore: 0 }), "2026-07-01", NOW)],
    ]);

    it("keeps what is being worked on and leaves the catalogue out", () => {
        const built = buildRepertoire(items, (id) => byId.get(id) ?? null, TODAY, NOW);
        // "untouched" has no score and no date — it is catalogue, not repertoire.
        // "absent" has no stored mastery at all.
        expect(built.map((one) => one.item.id)).toEqual(["dated", "played"]);
    });

    it("flags a learned piece left well past its review date", () => {
        const stale = mastery({ intervalDays: 4, reviewAt: NOW - 20 * DAY_MS });
        const [built] = buildRepertoire([{ id: "stale" }], () => stale, TODAY, NOW);
        expect(built?.slipping).toBe(true);
    });
});
