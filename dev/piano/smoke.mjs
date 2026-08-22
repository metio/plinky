// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drives a deployed Plinky and checks that the recorded piano actually arrives.
//
// It exists because of a failure the whole test suite could not see: the port made a
// caller resolve notes through the manifest before it could ask for anything, the manifest
// only ever lives in memory, and so on every page load the prefetch waited for something
// only it would have fetched. Every unit passed. The feature was dead in production, and
// what found it was opening the deployed page and watching the network.
//
// So this is that, as a command. It is not a CI gate — it needs a deployment, an origin
// and a bucket, and a gate that depends on three live things is a gate that cries wolf.
// Run it after deploying, and after touching anything about where the recordings come
// from: the bucket's CORS, its custom domain, the base URL, the prefetch.
//
// Usage: node dev/piano/smoke.mjs [--base https://plinky.fun] [--piece 47xd2XDpYFCy]

import { chromium } from "playwright";

const BASE = (argValue("--base") ?? "https://plinky.fun").replace(/\/$/, "");
const PIECE = argValue("--piece") ?? "47xd2XDpYFCy";
const SWITCH = argValue("--switch") ?? "Recorded grand piano";
const WAIT = Number(argValue("--wait") ?? 20000);

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

const problems = [];
const bad = (message) => {
    problems.push(message);
    console.log(`  ✗ ${message}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const asked = [];
page.on("response", (response) => {
    if (response.url().includes("samples.")) {
        asked.push({ status: response.status(), file: response.url().split("/").pop() });
    }
});
const errors = [];
page.on("console", (message) => {
    if (message.type() === "error") {
        errors.push(message.text());
    }
});

try {
    console.log(`${BASE} — turning the recorded piano on`);
    await page.goto(`${BASE}/en/settings/`, { waitUntil: "domcontentloaded" });
    const toggle = page.getByRole("switch", { name: SWITCH });
    if ((await toggle.count()) === 0) {
        bad(`no "${SWITCH}" switch on the settings page`);
    } else {
        await toggle.click();
        await page.waitForTimeout(4000);
        const fromSwitch = asked.length;

        // A fresh page load, which is the case that was broken: the choice survives in
        // storage, the manifest does not, and only the piece's own prefetch can bring it
        // back.
        console.log("opening a piece on a fresh load");
        await page.goto(`${BASE}/en/play/${PIECE}/`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(WAIT);

        const fromPiece = asked.slice(fromSwitch);
        const recordings = new Set(
            fromPiece.filter((one) => one.file.endsWith(".opus")).map((one) => one.file),
        );
        if (recordings.size === 0) {
            bad("the piece asked for no recordings — the prefetch is not reaching the pack");
        }
        for (const failure of asked.filter((one) => one.status !== 200)) {
            bad(`${failure.file}: ${failure.status}`);
        }
        const cors = errors.filter((line) => /CORS|Access-Control/i.test(line));
        for (const line of cors.slice(0, 3)) {
            bad(`CORS: ${line.slice(0, 140)}`);
        }
        console.log(
            `  ${asked.length} requests, ${recordings.size} distinct recordings for the piece`,
        );
    }
} finally {
    await browser.close();
}

console.log(
    problems.length === 0
        ? "\nThe recorded piano arrives: switch, manifest, and a piece fetching its own notes."
        : `\n${problems.length} problems.`,
);
process.exit(problems.length === 0 ? 0 : 1);
