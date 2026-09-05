// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where every promo clip ends, and what decided it — without encoding a frame.
//
// A batch of clips is meant to end at a natural pause, somewhere in the twenty-to-thirty
// second window, averaging around twenty-five. Whether it does was previously answerable
// only by rendering an hour of video and measuring the files, which is a slow way to
// learn that half of them ran long. This reads the same performance the renderer reads,
// through the same core cut, and prints the distribution.
//
// Usage: npm run promo:cuts [-- --only text] [--collections]

import { chromium } from "playwright";
import { PIECES } from "./promo/pieces.mjs";
import { collectionPieces } from "./promo/collections.mjs";
import { startDevServer } from "./promo/devServer.mjs";
import { readSongsSync } from "./manifest.mts";

const PORT = 5198;
const ONLY = argValue("--only");
const chosen = process.argv.includes("--collections") ? collectionPieces() : PIECES;

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

const manifest = readSongsSync();
// Our own server, on our own port, or nothing: a report that reads a stale module graph
// answers for code that is not running.
const server = await startDevServer(PORT);
const base = `http://localhost:${PORT}`;

const rows = [];
try {
    const browser = await chromium.launch({ args: ["--disable-gpu"] });
    const page = await browser.newPage();
    await page.goto(`${base}/en/`, { waitUntil: "domcontentloaded" });

    for (const piece of chosen) {
        if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) continue;
        const song = manifest.find((entry) => entry.id === piece.id);
        if (!song) {
            console.warn(`  ${piece.title}: not in the manifest`);
            continue;
        }
        try {
            const report = await page.evaluate(
                async (request) => {
                    const module = await import("/dev/promo/renderPromo.ts");
                    return await module.reportCut(request);
                },
                {
                    scoreUrl: `/songs/${song.license.toLowerCase()}/${piece.id}.mxl`,
                    title: piece.title,
                    credit: `${piece.composer} · CC0`,
                    width: 1080,
                    height: 1080,
                    fps: 60,
                    clipMs: 20_000,
                },
            );
            rows.push({ title: piece.title, ...report });
            const chose =
                report.pauseMs === undefined
                    ? "NO PAUSE — bounded"
                    : `pause ${Math.round(report.pauseMs)}ms`;
            console.log(
                `  ${(report.durationMs / 1000).toFixed(1)}s  ${piece.title.padEnd(38)}` +
                    `${chose.padEnd(22)}${report.gaps.length} gaps in window`,
            );
        } catch (error) {
            console.error(`  ${piece.title}: ${error?.message ?? error}`);
        }
    }
    await browser.close();
} finally {
    server.kill();
}

if (rows.length > 0) {
    const lengths = rows.map((row) => row.durationMs / 1000).sort((a, b) => a - b);
    const n = lengths.length;
    const median = n % 2 ? lengths[(n - 1) / 2] : (lengths[n / 2 - 1] + lengths[n / 2]) / 2;
    const mean = lengths.reduce((a, b) => a + b, 0) / n;
    const inWindow = lengths.filter((s) => s >= 20 && s <= 30.5).length;
    const noPause = rows.filter((row) => row.pauseMs === undefined).length;
    const shorter = rows.filter((row) => row.performanceMs < 20_000).length;
    console.log(
        `\n  ${n} clips | median ${median.toFixed(1)}s | mean ${mean.toFixed(1)}s | ` +
            `range ${lengths[0].toFixed(1)}-${lengths[n - 1].toFixed(1)}s`,
    );
    console.log(
        `  ${inWindow}/${n} inside the window | ${noPause} found no pause | ` +
            `${shorter} pieces shorter than the window`,
    );
    // What the no-pause pieces had instead, which is what any fallback has to work with.
    const widest = rows
        .filter((row) => row.pauseMs === undefined)
        .map((row) => Math.max(0, ...row.gaps.map((gap) => gap.gapMs)));
    if (widest.length > 0) {
        const none = widest.filter((w) => w === 0).length;
        console.log(
            `  of those ${widest.length}: ${none} have no silence at all in the window; ` +
                `the rest peak at ${Math.round(Math.max(...widest))}ms`,
        );
    }
}
