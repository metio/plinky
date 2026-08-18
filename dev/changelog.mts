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
const entries = releases.reduce((count, release) => count + release.entries.length, 0);

if (!check) {
    await writeFile(NEWS_FILE, rendered);
    console.log(`${NEWS_FILE}: ${releases.length} releases, ${entries} entries`);
    process.exit(0);
}

const current = await readFile(NEWS_FILE, "utf8").catch(() => "");
if (current === rendered) {
    console.log(`${NEWS_FILE} is current (${releases.length} releases, ${entries} entries)`);
    process.exit(0);
}

const at = [...rendered].findIndex((character, index) => character !== current[index]);
console.error(
    `${NEWS_FILE} does not match ${CHANGELOG_FILE}. Run \`npm run news\` and commit the result.\n` +
        `First difference at character ${at}:\n` +
        `  in ${NEWS_FILE}:      ${JSON.stringify(current.slice(Math.max(0, at - 40), at + 40))}\n` +
        `  from ${CHANGELOG_FILE}: ${JSON.stringify(rendered.slice(Math.max(0, at - 40), at + 40))}`,
);
process.exit(1);
