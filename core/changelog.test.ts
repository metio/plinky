// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    headingFor,
    parseChangelog,
    POST_LIMIT,
    type Release,
    renderNews,
    ROUND_UP_PREFIX,
    roundUp,
    roundUpBody,
    roundUpsToUnpin,
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

    it("covers the week ending yesterday, not the day it runs", () => {
        // A day is only reported once it is over. Including the run's own day would post
        // it twice — here, and again next week where it is the day exactly a week back.
        expect(roundUp(week, "2026-08-18", 7).map((one) => one.date)).toEqual([
            "2026-08-14",
            "2026-08-11",
        ]);
    });

    it("reaches an entry written after the run went out", () => {
        // The cron fires in the evening. Anything filed at nine belongs to a day this
        // run has already passed, so the next run has to still be able to reach it.
        expect(roundUp(week, "2026-08-25", 7).map((one) => one.date)).toContain("2026-08-18");
    });

    it("posts every release exactly once across consecutive weekly runs", () => {
        // The property that matters more than either boundary: run it every seven days
        // and each release appears in exactly one round-up — no gaps, no repeats.
        const daily: Release[] = Array.from({ length: 40 }, (_, index) =>
            release({ date: `2026-07-${String(index + 1).padStart(2, "0")}` }),
        ).filter((one) => Number(one.date.slice(8)) <= 31);
        const posted: string[] = [];
        for (let day = 8; day <= 36; day += 7) {
            const on = `2026-08-${String(day - 31).padStart(2, "0")}`;
            for (const one of roundUp(
                daily,
                day <= 31 ? `2026-07-${String(day).padStart(2, "0")}` : on,
                7,
            )) {
                posted.push(one.date);
            }
        }
        expect(posted).toEqual([...new Set(posted)]);
        // Every day of July from the 1st to the 30th is covered by one of those runs.
        for (let day = 1; day <= 30; day++) {
            expect(posted).toContain(`2026-07-${String(day).padStart(2, "0")}`);
        }
    });

    it("covers nothing at all for a day that is not a real day", () => {
        // daysBetween reports 0 for a date it cannot read, which without this guard puts
        // every release ever written inside the window — the whole changelog, posted.
        expect(roundUp(week, "2026-18-08", 7)).toEqual([]);
        expect(roundUp(week, "not-a-day", 7)).toEqual([]);
    });

    it("leaves out an entry that asked to stay out", () => {
        const releases = [
            release({
                date: "2026-08-17",
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
            release({ date: "2026-08-17", entries: [{ body: "**Held.** No.", twip: false }] }),
        ];
        expect(roundUp(releases, "2026-08-18", 7)).toEqual([]);
    });

    it("ignores a release dated after the round-up's day", () => {
        expect(roundUp(week, "2026-08-12", 7).map((one) => one.date)).toEqual([
            "2026-08-11",
            "2026-08-10",
        ]);
    });

    it("is empty for a week that shipped nothing worth posting", () => {
        // What stops the round-up posting "nothing happened" every week.
        expect(roundUp(week, "2026-09-30", 7)).toEqual([]);
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
        expect(
            body.endsWith(
                "Play at https://plinky.fun — free, in your browser, nothing to install.",
            ),
        ).toBe(true);
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

describe("roundUpsToUnpin", () => {
    const post = (title: string, stickied: boolean, name = title) => ({ name, title, stickied });

    it("takes down last week's so this week's can go up", () => {
        // A subreddit holds two stickied posts and refuses a third, so a job that only
        // ever pinned would work once, half-work once, and then stop — with the newest
        // week the one missing.
        const posts = [
            post("This week in Plinky — 18 August 2026", false),
            post("This week in Plinky — 11 August 2026", true, "t3_last"),
        ];
        expect(roundUpsToUnpin(posts, "This week in Plinky — 18 August 2026")).toEqual(["t3_last"]);
    });

    it("leaves somebody else's pinned post where it is", () => {
        const posts = [post("Welcome to r/plinky_piano — start here", true, "t3_welcome")];
        expect(roundUpsToUnpin(posts, "This week in Plinky — 18 August 2026")).toEqual([]);
    });

    it("leaves this week's own post alone when it is already up", () => {
        // The retry path pins a post that a previous run posted but failed to pin;
        // unpinning it first would undo the thing being fixed.
        const title = "This week in Plinky — 18 August 2026";
        expect(roundUpsToUnpin([post(title, true, "t3_this")], title)).toEqual([]);
    });

    it("ignores a round-up that is not pinned", () => {
        expect(
            roundUpsToUnpin([post("This week in Plinky — 4 August 2026", false)], "anything"),
        ).toEqual([]);
    });

    it("recognises a round-up by the title it is actually posted under", () => {
        // The prefix and the title are one string, so a reworded title cannot leave every
        // previous week pinned until the slots run out.
        expect(roundUpTitle("2026-08-18").startsWith(ROUND_UP_PREFIX)).toBe(true);
    });
});
