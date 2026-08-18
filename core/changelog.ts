// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What changed, and when — the only record Plinky keeps of it.
//
// There are no version numbers, no tags and no release days: every push to main deploys,
// so nothing derives this from the log and nothing ever could. Unwritten at the time
// means unwritten for good, which is why it is written by hand.
//
// It is the SOURCE, and NEWS.md is rendered from it — the README sends players to that
// file, and a block-scalar YAML document is no way to read a changelog. The weekly
// round-up posted to the subreddit reads the same entries. Two readers, one list: a
// second hand-kept copy would drift the first week somebody updated only one of them.

import { daysBetween, isDateKey } from "./dateKey";

export type ChangelogEntry = {
    // The entry exactly as it is published, Markdown and all: its bold lead, and any
    // paragraphs after it.
    //
    // Verbatim rather than split into a title and a body. The lead is prose, not a field
    // — "**The board is gone**, and so is the banner" has no title in it to lift out —
    // and a renderer that had to put one back together would be rewriting the register it
    // was written in. Storing what is published also means rendering is a copy, so the
    // file cannot drift from the list by way of a formatting rule nobody noticed.
    body: string;
    // Whether the weekly round-up carries it.
    //
    // Defaults to true, and the rare exception says otherwise. An entry is only here at
    // all if a player would notice the change, so almost everything qualifies — and with
    // the default the other way, forgetting the field would silently post nothing, which
    // is the failure you cannot see.
    twip: boolean;
};

export type Release = {
    // The day it shipped, as a date key. Several releases can share one: a day that went
    // out three times is three of these, told apart by their labels.
    date: string;
    // What follows the date in the heading — "night", "evening", "later". Null on a day
    // that shipped once, which is most of them.
    label: string | null;
    entries: ChangelogEntry[];
};

const ALLOWED_RELEASE = new Set(["date", "label", "entries"]);
const ALLOWED_ENTRY = new Set(["body", "twip"]);

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// The heading a release is published under: "18 August 2026", or "13 August 2026 — night"
// where a day shipped more than once.
//
// The month is named from a table rather than a locale format. This is one English
// document, and a name that came from the running environment's calendar data would make
// the rendered file depend on which machine rendered it.
export function headingFor(release: Release): string {
    const [year, month, day] = release.date.split("-");
    const name = MONTHS[Number(month) - 1] ?? month;
    const heading = `${Number(day)} ${name} ${year}`;
    return release.label === null ? heading : `${heading} — ${release.label}`;
}

function parseEntry(raw: unknown, at: string, problems: string[]): ChangelogEntry | null {
    // A bare string is the ordinary entry: one a player would notice, so the round-up
    // carries it and there is nothing else to say.
    if (typeof raw === "string") {
        return raw.trim() === ""
            ? (problems.push(`${at} is empty`), null)
            : { body: raw.trimEnd(), twip: true };
    }
    if (!raw || typeof raw !== "object") {
        return (problems.push(`${at} is neither text nor an entry`), null);
    }
    const record = raw as Record<string, unknown>;
    const unknown = Object.keys(record).filter((key) => !ALLOWED_ENTRY.has(key));
    if (unknown.length > 0) {
        problems.push(`${at} sets ${unknown.join(", ")}, which an entry has no room for`);
        return null;
    }
    if (typeof record.body !== "string" || record.body.trim() === "") {
        return (problems.push(`${at} has no body`), null);
    }
    if (record.twip !== undefined && typeof record.twip !== "boolean") {
        return (problems.push(`${at} sets twip to something that is not true or false`), null);
    }
    return { body: record.body.trimEnd(), twip: record.twip ?? true };
}

// Reads the file's shape without touching a disk, so the rules are testable and a
// malformed release is rejected with a reason rather than half-rendered.
export function parseChangelog(raw: unknown): { releases: Release[]; problems: string[] } {
    const problems: string[] = [];
    if (!Array.isArray(raw)) {
        return { releases: [], problems: ["the changelog must hold a list of releases"] };
    }
    const releases: Release[] = [];
    for (const [index, value] of raw.entries()) {
        const at = `release ${index}`;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            problems.push(`${at} is not a release`);
            continue;
        }
        const record = value as Record<string, unknown>;
        const unknown = Object.keys(record).filter((key) => !ALLOWED_RELEASE.has(key));
        if (unknown.length > 0) {
            problems.push(`${at} sets ${unknown.join(", ")}, which a release has no room for`);
            continue;
        }
        if (typeof record.date !== "string" || !isDateKey(record.date)) {
            problems.push(`${at} has no date, or one that is not a real day`);
            continue;
        }
        if (record.label !== undefined && record.label !== null && typeof record.label !== "string") {
            problems.push(`${record.date} has a label that is not text`);
            continue;
        }
        if (!Array.isArray(record.entries) || record.entries.length === 0) {
            problems.push(`${record.date} has no entries — a release nobody would notice is no release`);
            continue;
        }
        const entries = record.entries
            .map((entry, order) => parseEntry(entry, `${record.date} entry ${order}`, problems))
            .filter((entry): entry is ChangelogEntry => entry !== null);
        if (entries.length !== record.entries.length) {
            continue;
        }
        releases.push({ date: record.date, label: (record.label as string) ?? null, entries });
    }
    // Newest first, which is the order it is read in and the order it is written in. A
    // date out of order is a typo rather than a preference — the alternative is sorting
    // silently, which turns 2025 typed for 2026 into an entry nobody can find.
    for (const [index, release] of releases.entries()) {
        const previous = releases[index - 1];
        if (previous && daysBetween(release.date, previous.date) < 0) {
            problems.push(`${release.date} comes after ${previous.date}, which reads backwards`);
        }
    }
    return { releases, problems };
}

const HEADER = `<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# What's new

Plinky has no version numbers and no release days — every change goes live the moment
it's ready. This is what's changed, newest first, in plain terms.`;

const FOOTER = `---

Older changes aren't listed here; this file starts at 25 July 2026.`;

// The published file. Every block is separated by one blank line and the bodies are
// copied as they were written, so what renders is what somebody typed.
export function renderNews(releases: readonly Release[]): string {
    const blocks = [
        HEADER,
        ...releases.flatMap((release) => [
            `## ${headingFor(release)}`,
            ...release.entries.map((entry) => entry.body),
        ]),
        FOOTER,
    ];
    return `${blocks.join("\n\n")}\n`;
}

// The title the weekly round-up is posted under. Dated rather than numbered: a number
// would be a version, and Plinky does not have those.
export function roundUpTitle(on: string): string {
    return `This week in Plinky — ${headingFor({ date: on, label: null, entries: [] })}`;
}

// What a Reddit self post will hold. A body over this is refused outright, which on an
// unattended weekly run means a busy week posts nothing at all.
export const POST_LIMIT = 40_000;

const OPENING =
    "Everything that changed in Plinky this week. Plinky has no version numbers — every change goes live the moment it's ready, so this is just what landed.";
const CLOSING = "Play at https://plinky.fun — free, in your browser, nothing to install.";
const FULL_LIST = "https://github.com/metio/plinky/blob/main/NEWS.md";

// The round-up's body. The entries are already written for a player, so they go out as
// they were written; what is added is only the frame — a line saying what this is, and
// where to go and try it.
//
// It is trimmed to fit. A quiet week is every entry in full, which is the case worth
// optimising for; a week that shipped a hundred things takes as many as fit and says how
// many it left, because a post refused for length is a week nobody hears about, and
// fifty thousand characters was never going to be read anyway.
export function roundUpBody(releases: readonly Release[], limit = POST_LIMIT): string {
    const frame = (blocks: string[], dropped: number) =>
        [
            OPENING,
            ...blocks,
            ...(dropped === 0
                ? []
                : [
                      `…and ${dropped} more ${dropped === 1 ? "change" : "changes"} this week — the full list is at ${FULL_LIST}.`,
                  ]),
            "---",
            CLOSING,
        ].join("\n\n");

    const blocks: string[] = [];
    let dropped = releases.reduce((count, release) => count + release.entries.length, 0);
    for (const release of releases) {
        const heading = `**${headingFor(release)}**`;
        for (const entry of release.entries) {
            const grown = blocks.at(-1)?.startsWith(heading)
                ? [...blocks.slice(0, -1), `${blocks.at(-1)}\n\n${entry.body}`]
                : [...blocks, `${heading}\n\n${entry.body}`];
            // Measured against the finished post, frame and sign-off included, so the
            // budget cannot be spent on entries and then overrun by the closing line.
            if (frame(grown, dropped - 1).length > limit) {
                return frame(blocks, dropped);
            }
            blocks.splice(0, blocks.length, ...grown);
            dropped -= 1;
        }
    }
    return frame(blocks, 0);
}

// The releases a round-up covers: those within `days` of `on`, carrying only the entries
// that asked to be in it, and none that end up empty.
//
// The window is inclusive of both ends. A run that fires weekly on the same weekday would
// otherwise drop whatever shipped exactly seven days earlier, on the morning it last ran.
export function roundUp(
    releases: readonly Release[],
    on: string,
    days: number,
): Release[] {
    return releases
        .filter((release) => {
            const age = daysBetween(release.date, on);
            return age >= 0 && age <= days;
        })
        .map((release) => ({
            ...release,
            entries: release.entries.filter((entry) => entry.twip),
        }))
        .filter((release) => release.entries.length > 0);
}
