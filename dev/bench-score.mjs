// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long a piece takes to appear, on a slow device.
//
// The complaint this exists for is "the score takes a long time on slow devices", and the
// first thing to do with it is stop guessing. A spinner or an animation makes a wait
// pleasanter; it does not make it shorter, and which of those is wanted depends on where
// the time actually goes.
//
// Reproducible by construction: the browser's CPU is throttled by a fixed factor through
// the DevTools protocol rather than by whatever else this machine happens to be doing, each
// page is loaded in a fresh context with a cold cache, and every figure reported is a median
// of several runs. The same command on the same build gives the same answer.
//
//   nix develop --command node dev/bench-score.mjs [--rates 1,4,6] [--runs 5]
//
// Serve the build first, or pass --base:
//   nix develop --command npx http-server build/client -p 8420 -s

import { chromium } from "playwright";

const arg = (name, fallback) => {
    const hit = process.argv.find((one) => one.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8420");
const RATES = arg("rates", "1,4,6").split(",").map(Number);
const RUNS = Number(arg("runs", "5"));
// A real piece rather than a generated drill: a drill is a bar long and would report the
// engraver at its very best, which is not what anybody is waiting for.
const PIECE = arg("piece", "/en/play/47xd2XDpYFCy/");

const median = (values) => {
    const sorted = [...values].sort((one, other) => one - other);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// One cold load: how long until the engraved score is actually on screen, and what the
// browser spent that time on.
async function measure(browser, rate) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate });

    const started = Date.now();
    await page.goto(`${BASE}${PIECE}`, { waitUntil: "commit" });
    // The score is "there" when the engraver has drawn its first system — which is what a
    // reader is waiting for, not the load event.
    await page.waitForFunction(
        () => (document.querySelector("svg#osmdSvgPage1, #osmdCanvasPage1") ?? null) !== null,
        undefined,
        { timeout: 120_000 },
    );
    const visible = Date.now() - started;

    const detail = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const chunks = performance
            .getEntriesByType("resource")
            .filter((entry) => /\.js$/.test(entry.name))
            .map((entry) => ({
                name: entry.name.split("/").pop(),
                ms: Math.round(entry.duration),
                kb: Math.round((entry.encodedBodySize ?? 0) / 1024),
            }))
            .sort((one, other) => other.ms - one.ms)
            .slice(0, 4);
        const score = performance
            .getEntriesByType("resource")
            .filter((entry) => /\.(mxl|musicxml|xml)$/.test(entry.name))
            .map((entry) => Math.round(entry.duration));
        return {
            domInteractive: Math.round(nav?.domInteractive ?? 0),
            scoreFetchMs: score[0] ?? null,
            chunks,
        };
    });

    await context.close();
    return { visible, ...detail };
}

const browser = await chromium.launch();
console.log(`piece ${PIECE} · ${RUNS} runs per rate\n`);
for (const rate of RATES) {
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
        runs.push(await measure(browser, rate));
    }
    const visible = runs.map((one) => one.visible);
    const first = runs[0];
    console.log(
        `CPU ×${rate}  score visible: median ${median(visible)}ms  (min ${Math.min(...visible)}, max ${Math.max(...visible)})`,
    );
    console.log(
        `          domInteractive ${first.domInteractive}ms · score fetch ${first.scoreFetchMs ?? "—"}ms`,
    );
    for (const chunk of first.chunks) {
        console.log(`          ${String(chunk.ms).padStart(5)}ms ${String(chunk.kb).padStart(4)}KB  ${chunk.name}`);
    }
}
await browser.close();
