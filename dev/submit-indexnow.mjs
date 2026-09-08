// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Tells the search engines which addresses this push changed. Run by the deploy job after
// the upload succeeds, with the commit the live site was built from before it:
//
//   node dev/submit-indexnow.mjs <previous commit> [<this commit>] [--dry-run]
//
// --dry-run prints the addresses it would submit and posts nothing, which is how to check
// the mapping without telling a search engine that pages changed when they did not.
//
// It reads the diff between the two, maps it to addresses (dev/indexnow.mjs), and posts
// them. Nothing here is allowed to fail a deploy: the site is already live, and a search
// engine having a bad afternoon is not a reason to go red. It says what it did and exits
// zero either way.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readPages } from "./pages.mjs";
import { INDEXNOW_ENDPOINT, changedPieces, changedUrls, submissions } from "./indexnow.mjs";

const SITE_URL = readFileSync("core/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)[1];
const HOST = new URL(SITE_URL).host;
const MANIFESTS = ["public/songs/manifest.json", "public/exercises/manifest.json"];

const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// A file as it stood at a commit, or null where it cannot be read — a shallow clone that
// never fetched that commit, a file that did not exist yet, a first deploy. Null means
// "unknown", and every row then reads as changed, which is the safe direction: the worst
// of it is one larger submission.
function at(commit, path) {
    try {
        return JSON.parse(git("show", `${commit}:${path}`));
    } catch {
        return null;
    }
}

function changedFiles(from, to) {
    try {
        return git("diff", "--name-only", `${from}..${to}`).split("\n").filter(Boolean);
    } catch {
        return [];
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dry = args.includes("--dry-run");
    const [from, to = "HEAD"] = args.filter((arg) => !arg.startsWith("--"));
    if (!from) {
        console.log("indexnow: no previous commit given, so nothing is known to have changed.");
        return;
    }
    const { locales } = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
    const changed = changedFiles(from, to);
    const pieces = MANIFESTS.filter((path) => changed.includes(path)).flatMap((path) =>
        changedPieces(at(from, path), at(to, path)),
    );
    const urls = changedUrls({
        changed,
        pages: readPages().filter((page) => !page.dynamic),
        pieces,
        locales,
        siteUrl: SITE_URL,
    });
    if (urls.length === 0) {
        console.log(`indexnow: ${changed.length} files changed, none of which rewrites a page.`);
        return;
    }
    const batches = submissions(urls, { host: HOST });
    console.log(`indexnow: ${urls.length} addresses in ${batches.length} submission(s).`);
    if (dry) {
        for (const url of urls.slice(0, 20)) {
            console.log(`  ${url}`);
        }
        console.log(
            urls.length > 20 ? `  … and ${urls.length - 20} more (dry run)` : "  (dry run)",
        );
        return;
    }
    for (const batch of batches) {
        try {
            const response = await fetch(INDEXNOW_ENDPOINT, {
                method: "POST",
                headers: { "content-type": "application/json; charset=utf-8" },
                body: JSON.stringify(batch),
            });
            // 200 is accepted, 202 accepted-pending-key-check. Anything else is worth
            // reading in the log, and worth nothing more than that.
            console.log(`indexnow: ${batch.urlList.length} addresses → ${response.status}`);
        } catch (error) {
            console.log(`indexnow: submission failed — ${error}`);
        }
    }
}

await main();
