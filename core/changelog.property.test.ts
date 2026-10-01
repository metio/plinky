// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    headingFor,
    parseChangelog,
    POST_LIMIT,
    type Release,
    renderNews,
    roundUp,
    roundUpBody,
    ROUND_UP_PREFIX,
    roundUpTitle,
} from "./changelog";
import { shiftDay } from "./dateKey";

// The list of what changed, and the two things made from it: the published file players
// are sent to, and the weekly post. Plinky has no versions, so this list is the only
// record — an entry lost between the file and the post is a change nobody hears about,
// and one posted twice is a week that reads as a repeat.

// Written as somebody would type it: no leading or trailing space, which the parser
// trims and which therefore has no round trip to test.
const arbBody = fc
    .tuple(fc.stringMatching(/^[A-Za-z ,.']{5,60}$/), fc.stringMatching(/^[A-Za-z ,.']{0,80}$/))
    .map(([lead, rest]) => {
        const head = lead.trim() === "" ? "Something changed" : lead.trim();
        const tail = rest.trim();
        return tail === "" ? `**${head}**` : `**${head}**, ${tail}`;
    });

const arbEntry = fc.record({ body: arbBody, twip: fc.boolean() });

const arbRelease = (date: string): fc.Arbitrary<Release> =>
    fc
        .tuple(
            fc.option(fc.constantFrom("night", "evening", "later"), { nil: null }),
            fc.array(arbEntry, { minLength: 1, maxLength: 3 }),
        )
        .map(([label, entries]) => ({ date, label, entries }));

// Releases on distinct days, newest first, which is the order the file is written in.
const arbReleases = fc
    .uniqueArray(fc.integer({ min: 0, max: 40 }), { minLength: 1, maxLength: 8 })
    .chain((ages) =>
        fc.tuple(
            ...[...ages]
                .sort((a, b) => a - b)
                .map((age) => arbRelease(shiftDay("2026-09-01", -age))),
        ),
    )
    .map((releases) => releases as Release[]);

describe("reading the list of what changed", () => {
    it("never throws on whatever is in the file", () => {
        fc.assert(
            fc.property(fc.jsonValue({ maxDepth: 4 }), (raw) => {
                expect(() => parseChangelog(raw)).not.toThrow();
                const { releases, problems } = parseChangelog(raw);

                expect(Array.isArray(releases)).toBe(true);
                expect(Array.isArray(problems)).toBe(true);
                // Nothing malformed reaches a reader: every release that came back has
                // a real day, something to say, and a label or none.
                for (const release of releases) {
                    expect(release.entries.length).toBeGreaterThan(0);
                    expect(release.label === null || typeof release.label === "string").toBe(true);
                }
            }),
        );
    });

    it("reads back a list it just wrote, with nothing added or lost", () => {
        fc.assert(
            fc.property(arbReleases, (releases) => {
                const { releases: back, problems } = parseChangelog(
                    releases.map((release) => ({
                        date: release.date,
                        label: release.label,
                        entries: release.entries.map((entry) => ({ ...entry })),
                    })),
                );

                expect(problems).toEqual([]);
                expect(back).toEqual(releases);
            }),
        );
    });

    it("says so rather than guessing, when a release makes no sense", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    { date: "2026-02-31", entries: [{ body: "x" }] },
                    { date: "2026-09-01", entries: [] },
                    { date: "2026-09-01", entries: [{ body: "x" }], mood: "happy" },
                    { date: "2026-09-01", label: 7, entries: [{ body: "x" }] },
                    { entries: [{ body: "x" }] },
                    "not a release",
                ),
                (bad) => {
                    const { releases, problems } = parseChangelog([bad]);

                    // A release nobody can read is named as a problem, not dropped in
                    // silence and not half-published.
                    expect(releases).toEqual([]);
                    expect(problems.length).toBeGreaterThan(0);
                },
            ),
        );
    });

    it("refuses to sort a date that reads backwards", () => {
        const { problems } = parseChangelog([
            { date: "2026-08-01", entries: [{ body: "older first" }] },
            { date: "2026-09-01", entries: [{ body: "newer second" }] },
        ]);

        // Sorting silently would turn 2025 typed for 2026 into an entry nobody can find.
        expect(problems.some((problem) => problem.includes("backwards"))).toBe(true);
    });
});

describe("the published file", () => {
    it("copies out what somebody typed", () => {
        fc.assert(
            fc.property(arbReleases, (releases) => {
                const news = renderNews(releases);

                for (const release of releases) {
                    expect(news).toContain(`## ${headingFor(release)}`);
                    for (const entry of release.entries) {
                        // Verbatim: a renderer that reformatted the prose would be
                        // rewriting the register it was written in.
                        expect(news).toContain(entry.body);
                    }
                }
                expect(news.endsWith("\n")).toBe(true);
                expect(news).not.toContain("\n\n\n");
            }),
        );
    });

    it("heads a release the same way on any machine", () => {
        fc.assert(
            fc.property(arbReleases, (releases) => {
                for (const release of releases) {
                    const heading = headingFor(release);

                    // The month is named from a table, not the environment's calendar
                    // data, so the rendered file does not depend on who rendered it.
                    expect(heading).toMatch(
                        /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}( — .+)?$/,
                    );
                    expect(heading.includes(" — ")).toBe(release.label !== null);
                    expect(headingFor(release)).toBe(heading);
                }
            }),
        );
    });
});

describe("the weekly round-up", () => {
    it("covers the week that has ended, and only what asked to be in it", () => {
        fc.assert(
            fc.property(arbReleases, fc.integer({ min: 1, max: 14 }), (releases, days) => {
                const on = "2026-09-01";

                const covered = roundUp(releases, on, days);

                for (const release of covered) {
                    expect(release.entries.length).toBeGreaterThan(0);
                    for (const entry of release.entries) {
                        expect(entry.twip).toBe(true);
                    }
                    // The run's own day is left out: a day is reported once it is over.
                    expect(release.date).not.toBe(on);
                }
            }),
        );
    });

    it("tiles week after week, so nothing is posted twice or missed", () => {
        fc.assert(
            fc.property(arbReleases, (releases) => {
                // Walking BACK from the day after the newest release, so the windows
                // cover the span the releases actually occupy: each covers ages 1..7,
                // and seven of them reach the oldest of them.
                const weeks = [0, 1, 2, 3, 4, 5, 6].map((week) =>
                    roundUp(releases, shiftDay("2026-09-02", -7 * week), 7),
                );

                const posted = weeks.flatMap((week) =>
                    week.flatMap((release) =>
                        release.entries.map((entry) => `${release.date}:${entry.body}`),
                    ),
                );
                // Consecutive runs tile exactly — the reason the window ends yesterday
                // rather than today. An entry in two round-ups reads as a repeat; one in
                // none is a change nobody hears about.
                expect(new Set(posted).size).toBe(posted.length);

                const eligible = releases.flatMap((release) =>
                    release.entries
                        .filter((entry) => entry.twip)
                        .map((entry) => `${release.date}:${entry.body}`),
                );
                for (const one of eligible) {
                    expect(posted).toContain(one);
                }
            }),
        );
    });

    it("covers nothing for a day that is not a day", () => {
        fc.assert(
            fc.property(
                arbReleases,
                fc.constantFrom("", "today", "2026-02-31", "NaN-NaN-NaN"),
                (releases, on) => {
                    // daysBetween reports 0 for a date it cannot read, which without the
                    // guard would put every release ever written inside the window.
                    expect(roundUp(releases, on, 7)).toEqual([]);
                },
            ),
        );
    });
});

describe("the post itself", () => {
    it("fits in the space a post has", () => {
        fc.assert(
            // Limits that straddle the size of a generated week, so the trim actually
            // runs. A limit far above the content never exercises the budget at all,
            // and the real failure is a post that overruns by its own sign-off — which
            // only shows up at the boundary. The floor clears the frame, which is 332
            // characters with the line naming what was left out.
            fc.property(arbReleases, fc.integer({ min: 400, max: 2600 }), (releases, limit) => {
                const body = roundUpBody(releases, limit);

                // A post refused for length is a week nobody hears about.
                expect(body.length).toBeLessThanOrEqual(limit);
            }),
        );
        // And the generous case, where everything fits.
        fc.assert(
            fc.property(arbReleases, (releases) => {
                expect(roundUpBody(releases, POST_LIMIT).length).toBeLessThanOrEqual(POST_LIMIT);
            }),
        );
    });

    it("says how much it left out", () => {
        fc.assert(
            fc.property(arbReleases, (releases) => {
                const full = roundUpBody(releases, POST_LIMIT);
                const total = releases.reduce((sum, release) => sum + release.entries.length, 0);

                expect(full).toContain("plinky.fun");
                for (const release of releases) {
                    for (const entry of release.entries) {
                        expect(full).toContain(entry.body);
                    }
                }
                // A trimmed post names the shortfall rather than ending mid-week.
                const trimmed = roundUpBody(releases, 1200);
                if (!trimmed.includes(releases[0]?.entries[0]?.body ?? "")) {
                    expect(trimmed).toMatch(/…and \d+ more change/);
                }
                expect(total).toBeGreaterThan(0);
            }),
        );
    });

    it("titles every week the same way, so last week's can be found", () => {
        fc.assert(
            fc.property(fc.constantFrom("2026-09-01", "2026-12-31", "2027-01-01"), (on) => {
                // A reworded title that no longer matched would quietly leave every
                // previous week pinned until the slots ran out.
                expect(roundUpTitle(on).startsWith(ROUND_UP_PREFIX)).toBe(true);
            }),
        );
    });
});
