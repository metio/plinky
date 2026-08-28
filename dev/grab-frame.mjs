// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One frame out of a rendered clip, as a PNG, so a video can be looked at rather than
// reasoned about.
//
// Through Chromium rather than ffmpeg because this host's ffmpeg has no H.264 decoder —
// it can mux and transcode audio for the promo pipeline and cannot read back what the
// browser encoded. Chromium wrote the file, so Chromium can certainly read it.
//
// Usage: npm run promo:frame -- <clip.mp4> <out.png> [seconds]
//
// It earned its place the first time it was run: the credit line, which the catalogue
// requires be burnt into every frame, turned out to be printed over the white keys at a
// fixed 0.95 of the frame height while the keyboard ended at 0.96. Nothing in the tests
// could see it and nobody had looked.

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const [file, out, at] = process.argv.slice(2);
const b64 = readFileSync(file).toString("base64");
const browser = await chromium.launch();
// A generous viewport; the video element is then sized to the clip's own dimensions below.
// Forcing every clip into one shape letterboxed the landscape ones inside black bands and
// made a correct render look broken — the tool has to take the video's shape, not impose
// one.
const page = await browser.newPage({ viewport: { width: 1920, height: 1920 } });
await page.setContent(
    `<body style="margin:0;background:#000"><video id="v" src="data:video/mp4;base64,${b64}"></video></body>`,
);
await page.waitForFunction(
    () => {
        const v = document.querySelector("video");
        return v && v.readyState >= 2;
    },
    { timeout: 30000 },
);
await page.evaluate((t) => {
    const v = document.querySelector("video");
    return new Promise((resolve) => {
        v.onseeked = resolve;
        v.currentTime = t;
    });
}, Number(at));
// Native size, so a pixel in the file is a pixel in the picture.
await page.evaluate(() => {
    const v = document.querySelector("video");
    v.style.width = `${v.videoWidth}px`;
    v.style.height = `${v.videoHeight}px`;
});
const shape = await page.evaluate(() => {
    const v = document.querySelector("video");
    return `${v.videoWidth}x${v.videoHeight}`;
});
await page.locator("#v").screenshot({ path: out });
console.log(`  ${shape}`);
await browser.close();
console.log("wrote", out);
