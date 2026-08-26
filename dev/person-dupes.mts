// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every pair of composer pages that might be one person, checked against the pairs somebody
// has already ruled on. It never merges anything: a candidate is a question for a human,
// because the same surname under two first names is a father and a son as often as it is
// one person spelled twice.
//
//   npm run people:dupes            the report, every candidate pair
//   npm run people:dupes -- --check the gate: fails on a pair nobody has ruled on
//
// This was a report nobody ran, and it cost exactly what an unrun report costs. Burgmüller
// held three composer pages — a bare surname, an un-umlauted spelling, and his full name —
// and it went unnoticed until a reader browsing the site found it. The report could not have
// caught it either, because it read only the songs manifest and both strays live in the
// exercises one. Both halves of that are fixed here: it reads every credit the catalogue
// carries, and it is a gate.
//
// A ruling is a pair of names and a reason. The reason is the point: a bare pair, a year
// later, is indistinguishable from somebody silencing the gate — the same argument
// dev/curation.mts makes about a bare id and a replacement string. Where two names really
// are one person, the fix is not a ruling here but an alias in core/person.ts, which merges
// them everywhere at once.

import { readFile } from "node:fs/promises";
import { candidatePairs, compare, creditedPeople, parseRulings } from "./personDupes.mts";

const SONGS = "public/songs/manifest.json";
const EXERCISES = "public/exercises/manifest.json";
// Pairs a human has ruled on as genuinely two people. Data rather than a code list, for the
// same reason the catalogue's other hand-kept files are: an import rewrites the manifests,
// and a judgement made once should outlive them.
const RULINGS = "dev/catalog-people-distinct.json";

const check = process.argv.includes("--check");

async function credits(path: string): Promise<string[]> {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    return items.map((item: { composer?: string }) => item.composer ?? "");
}

const counts = creditedPeople([...(await credits(SONGS)), ...(await credits(EXERCISES))]);
const pairs = candidatePairs([...counts.keys()]);

let raw: unknown;
try {
    raw = JSON.parse(await readFile(RULINGS, "utf8"));
} catch (error) {
    console.error(`${RULINGS} is not readable: ${(error as Error).message}`);
    process.exit(1);
}
const { rulings, problems } = parseRulings(raw);
if (problems.length > 0) {
    console.error(`${RULINGS}:\n- ${problems.join("\n- ")}`);
    process.exit(1);
}

const { unruled, unused } = compare(pairs, rulings);
const held = (name: string) => counts.get(name) ?? 0;

if (!check) {
    console.log(`${counts.size} composer pages, ${pairs.length} candidate pairs\n`);
    for (const { a, b, why } of [...pairs].sort((x, y) => x.why.localeCompare(y.why))) {
        const ruled = unruled.some((one) => one.a === a && one.b === b) ? "  NEW" : "";
        console.log(`  [${why}]  ${a} (${held(a)})  <->  ${b} (${held(b)})${ruled}`);
    }
    process.exit(0);
}

if (unruled.length === 0 && unused.length === 0) {
    console.log(
        `${counts.size} composer pages: all ${pairs.length} candidate pair(s) ruled on in ${RULINGS}.`,
    );
    process.exit(0);
}

for (const { a, b, why } of unruled) {
    console.error(`✗ nobody has ruled on [${why}]  ${a} (${held(a)})  <->  ${b} (${held(b)})`);
}
for (const { a, b } of unused) {
    console.error(`✗ ${RULINGS} rules on ${a} <-> ${b}, which the catalogue no longer pairs`);
}
console.error(
    `\nIf they are two people, add the pair to ${RULINGS} with a "why".\n` +
        "If they are one person, add an alias to core/person.ts instead — that merges them\n" +
        "everywhere at once — then run `npm run songs:bake` and commit the baked index.\n" +
        "A ruling the catalogue no longer pairs is stale: remove the entry.",
);
process.exit(1);
