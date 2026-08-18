// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    headingFor,
    parseChangelog,
    POST_LIMIT,
    type Release,
    renderNews,
    roundUp,
    roundUpBody,
    roundUpTitle,
} from "./changelog";

const release = (patch: Partial<Release> = {}): Release => ({
    date: "2026-08-18",
    label: null,
    entries: [{ body: "**Something changed.** And here is what it means.", twip: true }],
    ...patch,
});

describe("parseChangelog", () => {
    it("reads a release whose entries are plain text", () => {
        const { releases, problems } = parseChangelog([
            { date: "2026-08-18", entries: ["**A thing.** It happened."] },
        ]);
        expect(problems).toEqual([]);
        expect(releases).toEqual([
            {
                date: "2026-08-18",
                label: null,
                entries: [{ body: "**A thing.** It happened.", twip: true }],
            },
        ]);
    });

    it("puts an entry in the round-up unless it says otherwise", () => {
        // The default that matters: an entry is only here at all if a player would notice
        // it, so opting in would mean a forgotten field silently posts nothing.
        const { releases } = parseChangelog([
            {
                date: "2026-08-18",
                entries: ["**Loud.** Yes.", { body: "**Quiet.** No.", twip: false }],
            },
        ]);
        expect(releases[0]?.entries.map((entry) => entry.twip)).toEqual([true, false]);
    });

    it("keeps the label that tells two releases of one day apart", () => {
        const { releases } = parseChangelog([
            { date: "2026-08-13", label: "night", entries: ["**Late.** Yes."] },
        ]);
        expect(releases[0]?.label).toBe("night");
    });

    it("refuses a date that is not a real day", () => {
        expect(parseChangelog([{ date: "2026-02-31", entries: ["x"] }]).problems[0]).toContain(
            "not a real day",
        );
        expect(parseChangelog([{ entries: ["x"] }]).problems[0]).toContain("no date");
    });

    it("refuses a release nobody would notice", () => {
        expect(parseChangelog([{ date: "2026-08-18", entries: [] }]).problems[0]).toContain(
            "no entries",
        );
    });

    it("refuses a field it does not know, rather than dropping it silently", () => {
        // A misspelled `twip` that parsed as an unknown key and vanished would leave the
        // entry posting when it asked not to.
        expect(
            parseChangelog([{ date: "2026-08-18", entries: [{ body: "x", tweep: false }] }])
                .problems[0],
        ).toContain("tweep");
        expect(
            parseChangelog([{ date: "2026-08-18", entries: ["x"], version: "1" }]).problems[0],
        ).toContain("version");
    });

    it("says so when a date reads backwards", () => {
        // Sorting silently would turn 2025 typed for 2026 into an entry nobody can find.
        const { problems } = parseChangelog([
            { date: "2026-08-01", entries: ["**One.** Yes."] },
            { date: "2026-08-18", entries: ["**Two.** Yes."] },
        ]);
        expect(problems[0]).toContain("reads backwards");
    });

    it("says so when the file is not a list of releases at all", () => {
        expect(parseChangelog({ date: "2026-08-18" }).problems[0]).toContain("list of releases");
    });
});

describe("headingFor", () => {
    it("names the day the way the page prints it", () => {
        expect(headingFor(release({ date: "2026-08-18" }))).toBe("18 August 2026");
        expect(headingFor(release({ date: "2026-01-05" }))).toBe("5 January 2026");
    });

    it("hangs the label off the date where a day shipped more than once", () => {
        expect(headingFor(release({ date: "2026-08-13", label: "night" }))).toBe(
            "13 August 2026 — night",
        );
    });
});

describe("renderNews", () => {
    it("copies a body out as it was written", () => {
        // Rendering is a copy on purpose: a formatting rule applied on the way out would
        // rewrite the register the entry was written in.
        const body = "**A thing.** Line one\nwrapped onto line two.\n\n- and a list item";
        const rendered = renderNews([release({ entries: [{ body, twip: true }] })]);
        expect(rendered).toContain(body);
    });

    it("separates every block by one blank line and ends the file with a newline", () => {
        const rendered = renderNews([release()]);
        expect(rendered).not.toMatch(/\n\n\n/);
        expect(rendered.endsWith("\n")).toBe(true);
        expect(rendered).toContain("## 18 August 2026\n\n**Something changed.**");
    });
});

describe("roundUp", () => {
    const week: Release[] = [
        release({ date: "2026-08-18", entries: [{ body: "**Today.** Yes.", twip: true }] }),
        release({ date: "2026-08-14", entries: [{ body: "**Midweek.** Yes.", twip: true }] }),
        release({ date: "2026-08-11", entries: [{ body: "**Seven back.** Yes.", twip: true }] }),
        release({ date: "2026-08-10", entries: [{ body: "**Too old.** Yes.", twip: true }] }),
    ];

    it("covers the week up to and including the day seven back", () => {
        // Inclusive at both ends: a run firing weekly on the same weekday would otherwise
        // drop whatever shipped on the morning it last ran.
        expect(roundUp(week, "2026-08-18", 7).map((one) => one.date)).toEqual([
            "2026-08-18",
            "2026-08-14",
            "2026-08-11",
        ]);
    });

    it("leaves out an entry that asked to stay out", () => {
        const releases = [
            release({
                date: "2026-08-18",
                entries: [
                    { body: "**Posted.** Yes.", twip: true },
                    { body: "**Held back.** No.", twip: false },
                ],
            }),
        ];
        expect(roundUp(releases, "2026-08-18", 7)[0]?.entries).toEqual([
            { body: "**Posted.** Yes.", twip: true },
        ]);
    });

    it("drops a release left with nothing to say", () => {
        const releases = [
            release({ date: "2026-08-18", entries: [{ body: "**Held.** No.", twip: false }] }),
        ];
        expect(roundUp(releases, "2026-08-18", 7)).toEqual([]);
    });

    it("is empty for a week that shipped nothing worth posting", () => {
        // What stops the round-up posting "nothing happened" every week.
        expect(roundUp(week, "2026-09-30", 7)).toEqual([]);
    });

    it("ignores a release dated after the round-up's day", () => {
        expect(roundUp(week, "2026-08-12", 7).map((one) => one.date)).toEqual([
            "2026-08-11",
            "2026-08-10",
        ]);
    });
});

describe("roundUpTitle", () => {
    it("is dated, because a number would be a version and there are none", () => {
        expect(roundUpTitle("2026-08-18")).toBe("This week in Plinky — 18 August 2026");
    });
});

describe("roundUpBody", () => {
    const many = (count: number): Release[] => [
        release({
            entries: Array.from({ length: count }, (_, index) => ({
                body: `**Change ${index}.** ${"Something happened that week. ".repeat(20)}`,
                twip: true,
            })),
        }),
    ];

    it("posts a quiet week in full, with nothing about what was left out", () => {
        const body = roundUpBody([release()]);
        expect(body).toContain("**Something changed.** And here is what it means.");
        expect(body).not.toContain("more change");
        expect(body).toContain("https://plinky.fun");
    });

    it("dates each day it covers", () => {
        expect(roundUpBody([release({ date: "2026-08-13", label: "night" })])).toContain(
            "**13 August 2026 — night**",
        );
    });

    it("fits a busy week inside what Reddit will take, and says what it left", () => {
        // A body over the limit is refused outright, so on an unattended weekly run a
        // hundred-change week would post nothing at all — the one week people would most
        // want to read about.
        const body = roundUpBody(many(400));
        expect(body.length).toBeLessThanOrEqual(POST_LIMIT);
        expect(body).toMatch(/…and \d+ more changes this week/);
        // The sign-off survives the trim: the budget is measured against the finished
        // post, not against the entries alone.
        expect(body.endsWith("Play at https://plinky.fun — free, in your browser, nothing to install.")).toBe(true);
    });

    it("counts one left-out change in the singular", () => {
        const entry = `**Change.** ${"x".repeat(500)}`;
        const two: Release[] = [
            release({
                entries: [
                    { body: entry, twip: true },
                    { body: entry, twip: true },
                ],
            }),
        ];
        // A limit that fits the frame and one entry but not the second.
        expect(roundUpBody(two, 1_000)).toContain("…and 1 more change this week");
    });

    it("keeps the frame even when nothing fits", () => {
        const body = roundUpBody(many(4), 400);
        expect(body).toContain("…and 4 more changes this week");
        expect(body).toContain("https://plinky.fun");
    });
});
