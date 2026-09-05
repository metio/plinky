// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What playing a piece actually costs to fetch.
//
// The library is 150 MB and nobody downloads it. Every recording is its own URL, the app
// knows a piece's notes before it plays one, and a cache keeps what it fetched — so the
// question is not what the instrument weighs but what a session does, and how quickly a
// player stops fetching anything at all. This walks real pieces through the same mapping
// the app would use and adds up the files.
//
// Usage: node dev/piano/measure-session.mjs --pack <dir with manifest.json> [--pieces 12]

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { regionFor } from "./voicing.mjs";
import { startDevServer } from "../promo/devServer.mjs";
import { readSongsSync } from "../manifest.mts";

const PACK = argValue("--pack");
const COUNT = Number(argValue("--pieces") ?? 12);
const PORT = 5203;

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

if (!PACK || !existsSync(join(PACK, "manifest.json"))) {
    console.error("Pass --pack <dir> holding manifest.json");
    process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8"));
const sizeOf = new Map(
    manifest.notes.map((region) => [region.file, statSync(join(PACK, region.file)).size]),
);
// The manifest carries what the SFZ said; the lookup is the one both sides share.
const regions = manifest.notes;

const songs = readSongsSync();
// A spread of the catalogue rather than the pieces the demo already used: grades 1 to 8,
// so the answer covers a beginner's first study and a Chopin nocturne alike.
const pieces = [];
for (let grade = 1; grade <= 8; grade++) {
    for (const song of songs
        .filter((entry) => entry.grade === grade && entry.license === "CC0-1.0")
        .slice(0, Math.ceil(COUNT / 8))) {
        pieces.push(song);
    }
}

const server = await startDevServer(PORT);
const base = `http://localhost:${PORT}`;

try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${base}/en/`, { waitUntil: "domcontentloaded" });

    // Every recording any of these pieces asked for, so the last column is what a player
    // who worked through all of them would have cached.
    const everSeen = new Set();
    console.log("  grade  notes  files      piece      cached after");
    for (const song of pieces.slice(0, COUNT)) {
        const played = await page.evaluate(async (url) => {
            const module = await import("/dev/piano/renderSampled.ts");
            return module.playedPairs(url);
        }, `/songs/${song.license.toLowerCase()}/${song.id}.mxl`);
        const files = new Set();
        for (const [pitch, velocity] of played) {
            files.add(regionFor(regions, pitch, velocity).file);
        }
        let bytes = 0;
        for (const file of files) {
            bytes += sizeOf.get(file) ?? 0;
            everSeen.add(file);
        }
        let cached = 0;
        for (const file of everSeen) {
            cached += sizeOf.get(file) ?? 0;
        }
        console.log(
            `  ${String(song.grade).padStart(5)}  ${String(played.length).padStart(5)}  ` +
                `${String(files.size).padStart(5)}  ${(bytes / 1_000_000).toFixed(1).padStart(6)} MB  ` +
                `${(cached / 1_000_000).toFixed(1).padStart(7)} MB  ${song.title.slice(0, 40)}`,
        );
    }
    await browser.close();
} finally {
    server.kill("SIGTERM");
}
