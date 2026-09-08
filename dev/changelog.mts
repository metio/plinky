// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders NEWS.md from changelog.yaml, and checks it is current.
//
// The list is the source and the file is a copy of it, so that the weekly round-up and
// the page players are sent to cannot disagree. `--check` is the gate: it renders and
// compares rather than writing, so a NEWS.md edited by hand, or one left behind by an
// entry added without regenerating, fails the build instead of shipping a changelog that
// no longer matches the changelog.
//
// The write also runs ahead of `typecheck`, which is what keeps that from being something
// to remember: edit the list, run any gate, and the file is already right.

import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";
import { parseChangelog, renderNews } from "../core/changelog";

export const CHANGELOG_FILE = "changelog.yaml";
export const NEWS_FILE = "NEWS.md";
// The slice of the list the /news page carries in its own document, generated into the
// source tree the way the composer index is.
//
// Two releases rather than all fifty-nine: the whole list is a hundred and sixty
// kilobytes, and a page that ships that to every visitor to read the top of it is a page
// nobody waits for. The newest two are the freshness a crawler and a returning player
// both come for; the rest arrives from build/client/news.json once the page is up.
export const LATEST_FILE = "core/newsLatest.ts";
export const LATEST_RELEASES = 2;

const check = process.argv.includes("--check");

const raw = await readFile(CHANGELOG_FILE, "utf8");
let loaded: unknown;
try {
    loaded = parse(raw);
} catch (error) {
    console.error(`${CHANGELOG_FILE} is not readable as YAML: ${(error as Error).message}`);
    process.exit(1);
}

const { releases, problems } = parseChangelog(loaded);
if (problems.length > 0) {
    console.error(`${CHANGELOG_FILE}:\n- ${problems.join("\n- ")}`);
    process.exit(1);
}

const rendered = renderNews(releases);

// A string literal the formatter would leave alone. The rule is the formatter's own: the
// quote needing fewer escapes wins, and a tie goes to the double. An entry quoting a piece
// title carries double quotes and so comes out in singles, and getting that wrong is a
// generated file that fails the lint gate with no way to fix it but regenerating.
const quote = (value: string): string => {
    const doubles = (value.match(/"/g) ?? []).length;
    const singles = (value.match(/'/g) ?? []).length;
    const mark = doubles > singles ? "'" : '"';
    const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replaceAll(mark, `\\${mark}`);
    return `${mark}${escaped}${mark}`;
};

// The generated module, written whole so that a diff of it reads as the entries changing.
const latestSource = (): string =>
    [
        // REUSE-IgnoreStart — the generated file's own header, not this file's.
        "// SPDX-FileCopyrightText: The Plinky Authors",
        "// SPDX-License-Identifier: AGPL-3.0-or-later",
        // REUSE-IgnoreEnd
        "",
        `// Generated from ${CHANGELOG_FILE} by dev/changelog.mts — do not edit.`,
        "//",
        "// The newest releases, in the page's own bundle so the /news document says what",
        "// changed without waiting for a fetch. The rest of the list is fetched.",
        "",
        'import type { Release } from "./changelog";',
        "",
        "export const LATEST_RELEASES: Release[] = [",
        // Written out rather than JSON.stringify'd, because the file is formatted source
        // the lint gate reads like any other: quoted keys and JSON's two-space indent are
        // a formatting failure, and one nothing can fix without regenerating the file.
        ...releases
            .slice(0, LATEST_RELEASES)
            .flatMap((release) => [
                "    {",
                `        date: ${quote(release.date)},`,
                `        label: ${release.label === null ? "null" : quote(release.label)},`,
                "        entries: [",
                ...release.entries.flatMap((entry) => [
                    "            {",
                    `                body: ${quote(entry.body)},`,
                    `                twip: ${entry.twip},`,
                    "            },",
                ]),
                "        ],",
                "    },",
            ]),
        "];",
        "",
    ].join("\n");
const entries = releases.reduce((count, release) => count + release.entries.length, 0);

if (!check) {
    await writeFile(NEWS_FILE, rendered);
    await writeFile(LATEST_FILE, latestSource());
    console.log(`${NEWS_FILE}: ${releases.length} releases, ${entries} entries`);
    process.exit(0);
}

const latestNow = await readFile(LATEST_FILE, "utf8").catch(() => "");
if (latestNow !== latestSource()) {
    console.error(
        `${LATEST_FILE} does not match ${CHANGELOG_FILE}. Run \`npm run news\` and commit the result.`,
    );
    process.exit(1);
}

const current = await readFile(NEWS_FILE, "utf8").catch(() => "");
if (current === rendered) {
    console.log(`${NEWS_FILE} is current (${releases.length} releases, ${entries} entries)`);
    process.exit(0);
}

// Where the two first disagree, counted in the units a string is actually indexed by.
// Spreading into an array walks code points while the comparison indexes code units, so
// the two disagree the moment anything outside the basic plane appears — and findIndex
// answers -1 when one file is merely the other with something added, which is the case
// most likely to be reported and the one that would point nowhere.
const firstDifference = (one: string, other: string): number => {
    const shared = Math.min(one.length, other.length);
    for (let index = 0; index < shared; index++) {
        if (one[index] !== other[index]) {
            return index;
        }
    }
    return shared;
};

const at = firstDifference(rendered, current);
console.error(
    `${NEWS_FILE} does not match ${CHANGELOG_FILE}. Run \`npm run news\` and commit the result.\n` +
        `First difference at character ${at}:\n` +
        `  in ${NEWS_FILE}:      ${JSON.stringify(current.slice(Math.max(0, at - 40), at + 40))}\n` +
        `  from ${CHANGELOG_FILE}: ${JSON.stringify(rendered.slice(Math.max(0, at - 40), at + 40))}`,
);
process.exit(1);
