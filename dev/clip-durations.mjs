// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long each rendered clip actually runs, and their mean.
//
// Through Chromium because this host's ffmpeg has no H.264 decoder — ffprobe reports
// "Unable to create decoder" and no duration at all. Chromium wrote the files, so it can
// certainly read them.
//
// What it is for: the clips are cut at a musical silence inside a window rather than at a
// fixed length (core/clipEnd), so the only way to know the batch averages where it was
// asked to is to measure the batch.
//
// Usage: npm run promo:durations -- promo/*/*/reel.mp4

const browser = await chromium.launch();
const page = await browser.newPage();
const out = [];
for (const file of process.argv.slice(2)) {
    const b64 = readFileSync(file).toString("base64");
    await page.setContent(`<video id="v" src="data:video/mp4;base64,${b64}"></video>`);
    const seconds = await page.evaluate(
        () =>
            new Promise((resolve) => {
                const v = document.querySelector("video");
                if (v.readyState >= 1) return resolve(v.duration);
                v.onloadedmetadata = () => resolve(v.duration);
                setTimeout(() => resolve(Number.NaN), 15000);
            }),
    );
    out.push(seconds);
    console.log(`  ${seconds.toFixed(1)}s  ${file.split("/").slice(-2, -1)[0]}`);
}
await browser.close();
const ok = out.filter(Number.isFinite);
if (ok.length) {
    const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
    console.log(
        `\n  ${ok.length} clips, mean ${mean.toFixed(1)}s, range ${Math.min(...ok).toFixed(1)}-${Math.max(...ok).toFixed(1)}s`,
    );
}
