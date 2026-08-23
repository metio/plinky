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
//   nix develop --command node dev/bench-score.mjs [--rates=1,4,6] [--runs=5] [--net=fast4g]
//
// The network matters as much as the CPU here and localhost has none, which flatters the
// app badly: a megabyte of engraver and six hundred kilobytes of catalogue arrive in
// milliseconds off the loopback and in seconds off a phone. Throttle both or the numbers
// describe a machine nobody owns.
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
// Chrome's own published profiles, so the figures are comparable with anyone else's.
const NETWORKS = {
    none: null,
    fast4g: {
        downloadThroughput: (9 * 1024 * 1024) / 8,
        uploadThroughput: (1.5 * 1024 * 1024) / 8,
        latency: 85,
    },
    slow4g: {
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        latency: 300,
    },
};
const NET = arg("net", "fast4g");
// A returning player arrives with the shell already cached, so the download stops dominating
// and what is left is the app's own work — a different bottleneck, and the one an ordering
// change can actually move. Measured by loading the piece twice in one context and reporting
// the second.
const WARM = process.argv.includes("--warm");

const median = (values) => {
    const sorted = [...values].sort((one, other) => one - other);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// One cold load: how long until the engraved score is actually on screen, and what the
// browser spent that time on.
async function measure(browser, rate) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        // The service worker is blocked, and that is the whole reason any byte-level figure
        // here means anything. Plinky's worker intercepts every same-origin GET, and the
        // DevTools network throttling applied below governs the PAGE's network stack, not the
        // worker's — so with it running, a 1.27 MB chunk arrives in 28 ms over a link
        // emulated at 200 KB/s, reporting a transferSize of zero because a worker answered.
        // Every byte saved is invisible, and the measurement quietly describes a different
        // machine from the one it claims to.
        //
        // What this measures, then, is a first-time visitor: nothing cached, nothing
        // installed, every byte crossing the emulated link. That is the load worth being
        // fast, and the one an optimisation has to be judged against.
        serviceWorkers: "block",
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate });
    await client.send("Network.enable");
    // A fresh browser CONTEXT is not a fresh cache: Chromium's HTTP cache is shared across
    // contexts of one browser, so without this the first run measures a cold load and every
    // run after it measures a warm one — and the median of five is mostly the wrong number.
    // Found by noticing that a 1.27 MB chunk was arriving in 29 ms over a throttled link,
    // with a transferSize of zero.
    await client.send("Network.setCacheDisabled", { cacheDisabled: !WARM });
    const shape = NETWORKS[NET];
    if (shape === undefined) {
        throw new Error(`unknown --net=${NET}; pick one of ${Object.keys(NETWORKS).join(", ")}`);
    }
    if (shape) {
        await client.send("Network.emulateNetworkConditions", { offline: false, ...shape });
    }

    if (WARM) {
        await page.goto(`${BASE}${PIECE}`, { waitUntil: "load" });
        await page
            .waitForFunction(
                () =>
                    (document.querySelector("svg#osmdSvgPage1, #osmdCanvasPage1") ?? null) !== null,
                undefined,
                { timeout: 120_000 },
            )
            .catch(() => {});
    }
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

    // Where the time went, in phases, read off the browser's own resource clock so the app
    // needs no instrumentation: everything before the engraver's code arrives is startup,
    // everything after it is the engraver.
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
        const musicEntries = performance
            .getEntriesByType("resource")
            .filter((entry) => /\.(mxl|musicxml|xml)$/.test(entry.name));
        const score = musicEntries.map((entry) => Math.round(entry.duration));
        const musicStart = musicEntries.length
            ? Math.round(Math.min(...musicEntries.map((entry) => entry.startTime)))
            : null;
        const all = performance.getEntriesByType("resource");
        const end = (pattern) =>
            all
                .filter((entry) => pattern.test(entry.name))
                .reduce((latest, entry) => Math.max(latest, entry.responseEnd), 0);
        // The engraver is by far the biggest chunk, so it identifies itself by weight
        // rather than by a name the bundler is free to change.
        const heaviest = all
            .filter((entry) => /\.js$/.test(entry.name))
            .sort((one, other) => (other.encodedBodySize ?? 0) - (one.encodedBodySize ?? 0))[0];
        return {
            domInteractive: Math.round(nav?.domInteractive ?? 0),
            scoreFetchMs: score[0] ?? null,
            engraverName: heaviest?.name.split("/").pop() ?? null,
            engraverKb: Math.round((heaviest?.encodedBodySize ?? 0) / 1024),
            engraverStartMs: Math.round(heaviest?.startTime ?? 0),
            engraverReadyMs: Math.round(heaviest?.responseEnd ?? 0),
            musicStartMs: musicStart,
            scoreReadyMs: Math.round(end(/\.(mxl|musicxml|xml)$/)),
            chunks,
        };
    });

    await context.close();
    return { visible, ...detail };
}

const browser = await chromium.launch();
console.log(`piece ${PIECE} · net ${NET} · ${RUNS} runs per rate\n`);
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
    // The two phases a fix has to choose between: getting the engraver and the music to the
    // page at all, and the engraving itself.
    const arrived = Math.max(first.engraverReadyMs, first.scoreReadyMs);
    console.log(
        `          fetch phase ${arrived}ms (engraver ${first.engraverReadyMs}ms/${first.engraverKb}KB · music ${first.scoreReadyMs}ms) · engraving ${first.visible - arrived}ms`,
    );
    console.log(
        `          domInteractive ${first.domInteractive}ms · asked for at: engraver ${first.engraverStartMs}ms · music ${first.musicStartMs}ms`,
    );
    for (const chunk of first.chunks) {
        console.log(
            `          ${String(chunk.ms).padStart(5)}ms ${String(chunk.kb).padStart(4)}KB  ${chunk.name}`,
        );
    }
}
await browser.close();
