// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders a catalogue piece twice — once through the synth Plinky ships, once through the
// Salamander Grand Piano — so the two can be listened to side by side before any of it is
// built into the app.
//
// Usage, with the library unpacked somewhere outside the repository:
//   node dev/piano/demo.mjs --library <dir> [--piece <title>] [--seconds 25] [--out dir]
//
// The library is 1.2 GB of WAV and is NOT redistributed here; download it from
// https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html (Salamander Grand Piano V3
// by Alexander Holm, CC-BY-3.0). It is served to the browser from its own little origin,
// because the dev server serves the repository and this is not part of it.

import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, normalize } from "node:path";
import { chromium } from "playwright";
import { readSfz } from "./salamander.mjs";

const OUT = argValue("--out") ?? "piano-demo";
const SECONDS = Number(argValue("--seconds") ?? 25);
const LIBRARY = argValue("--library");
const ONLY = argValue("--piece");
// Also render the clip the export panel would produce, with the sampled piano on it. The
// picture comes from the app's own painter and encoder, untouched; only the sound is
// swapped, which is the whole question being asked.
const VIDEO = process.argv.includes("--video");
const PORT = 5201;
const SAMPLE_PORT = 5202;

// Pieces that expose different things: a quiet one where the release tail is the whole
// character, a loud one where the velocity layers have to carry it, and a fast one where
// the attacks are all you hear.
const PIECES = [
    { id: "TOBNVaraGATl", title: "Gymnopédie No. 1", composer: "Erik Satie" },
    { id: "0nlCL3JvtjCl", title: "Nocturne in C-sharp minor", composer: "Frédéric Chopin" },
    { id: "yORzpFl5Dpfi", title: "Prelude in C, BWV 846", composer: "J. S. Bach" },
    { id: "8EKlMBPOS5dj", title: "The Entertainer", composer: "Scott Joplin" },
];

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

function slug(title) {
    return title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

async function waitForServer(url, attempts = 120) {
    for (let index = 0; index < attempts; index++) {
        try {
            if ((await fetch(url)).ok) {
                return;
            }
        } catch {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`dev server never came up at ${url}`);
}

// Serves the unpacked library with CORS open, so the page can fetch a recording by the
// path the SFZ names it by.
function serveSamples(root) {
    const server = createServer((request, response) => {
        const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
        const file = join(root, normalize(path));
        // Every answer carries the header, a miss included: without it the browser reports
        // a CORS failure for what is really a 404, which hides the actual mistake.
        const cors = { "access-control-allow-origin": "*" };
        if (!file.startsWith(normalize(root)) || !existsSync(file) || statSync(file).isDirectory()) {
            response.writeHead(404, cors);
            response.end();
            return;
        }
        response.writeHead(200, { ...cors, "content-type": "audio/wav" });
        createReadStream(file).pipe(response);
    });
    server.listen(SAMPLE_PORT);
    return server;
}

// A listenable file from the rendered WAV. Opus at 128k is transparent for this and small
// enough to send; the WAV stays beside it for anything that wants the original.
//
// Both voices are brought to the same loudness first. The synth peaks a hair under full
// scale and the sampled piano sits ten decibels below it — the layers are recorded at the
// dynamic they were played at — and a listener asked to compare two recordings at
// different levels will pick the louder one every time, whatever it sounds like.
function toOpus(wav) {
    const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (probe.error) {
        return null;
    }
    const opus = wav.replace(/\.wav$/, ".opus");
    const run = spawnSync(
        "ffmpeg",
        [
            "-y",
            "-loglevel",
            "error",
            "-i",
            wav,
            "-af",
            "loudnorm=I=-18:TP=-1.5:LRA=11",
            "-ar",
            "48000",
            "-c:a",
            "libopus",
            "-b:a",
            "128k",
            opus,
        ],
        { stdio: "inherit" },
    );
    return run.status === 0 ? opus : null;
}

// The app's exporter has no seam for a second voice, and putting one there before the
// question is answered would be building the thing rather than testing it. So the clip is
// encoded as it always is and its audio track is replaced afterwards: same frames, same
// timing, a different piano.
function withSampledAudio(video, wav) {
    const out = video.replace(/\.mp4$/, "-salamander.mp4");
    const run = spawnSync(
        "ffmpeg",
        [
            "-y", "-loglevel", "error",
            "-i", video,
            "-i", wav,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy",
            "-af", "loudnorm=I=-18:TP=-1.5:LRA=11",
            "-ar", "48000",
            "-c:a", "aac", "-b:a", "256k",
            "-shortest",
            out,
        ],
        { stdio: "inherit" },
    );
    return run.status === 0 ? out : null;
}

if (!LIBRARY || !existsSync(LIBRARY)) {
    console.error("Pass --library <dir> holding SalamanderGrandPianoV3.sfz");
    process.exit(1);
}

const sfz = join(LIBRARY, "SalamanderGrandPianoV3.sfz");
const regions = readSfz(sfz).map((region) => ({
    ...region,
    // Relative to the library root, which is what the sample server serves from.
    file: region.file.slice(LIBRARY.length).replace(/^\//, ""),
}));
console.log(`${regions.length} sampled regions from ${sfz.split("/").pop()}`);

const manifest = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));
mkdirSync(OUT, { recursive: true });

const samples = serveSamples(LIBRARY);
const server = spawn("npx", ["react-router", "dev", "--port", String(PORT)], {
    stdio: "inherit",
    env: process.env,
});
const base = `http://localhost:${PORT}`;

try {
    await waitForServer(`${base}/en/`);
    const browser = await chromium.launch({
        // The same flags the promo renderer uses: WebCodecs' hardware paths are absent in
        // headless, and these keep the software encoders available.
        args: ["--autoplay-policy=no-user-gesture-required", "--disable-gpu"],
    });
    const page = await browser.newPage();
    page.on("console", (message) => {
        if (message.type() === "error") {
            console.error("  browser:", message.text());
        }
    });
    await page.goto(`${base}/en/`, { waitUntil: "domcontentloaded" });

    for (const piece of PIECES) {
        if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) {
            continue;
        }
        const song = manifest.find((entry) => entry.id === piece.id);
        if (!song) {
            console.log(`${piece.title}: not in the manifest`);
            continue;
        }
        process.stdout.write(`${piece.title} … `);
        const started = Date.now();
        const result = await page.evaluate(
            async (request) => {
                const module = await import("/dev/piano/renderSampled.ts");
                const rendered = await module.renderSampled(request);
                return {
                    ...rendered,
                    sampled: Array.from(rendered.sampled),
                    synth: Array.from(rendered.synth),
                };
            },
            {
                scoreUrl: `/songs/${song.license.toLowerCase()}/${piece.id}.mxl`,
                samplesBase: `http://localhost:${SAMPLE_PORT}`,
                clipMs: SECONDS * 1000,
                regions,
            },
        );
        const name = slug(piece.title);
        const files = [];
        for (const [voice, bytes] of [
            ["salamander", result.sampled],
            ["synth", result.synth],
        ]) {
            const wav = `${OUT}/${name}-${voice}.wav`;
            writeFileSync(wav, Buffer.from(bytes));
            files.push(toOpus(wav) ?? wav);
        }
        if (VIDEO) {
            const bytes = await page.evaluate(
                async (request) => {
                    const module = await import("/dev/promo/renderPromo.ts");
                    return Array.from(await module.renderPromo(request));
                },
                {
                    scoreUrl: `/songs/${song.license.toLowerCase()}/${piece.id}.mxl`,
                    title: piece.title,
                    credit: `${piece.composer} · CC0 · Salamander Grand Piano (CC-BY)`,
                    width: 1080,
                    height: 1080,
                    fps: 30,
                    clipMs: SECONDS * 1000,
                    noteColor: "finger",
                    keyboardDepth: "shallow",
                },
            );
            const video = `${OUT}/${name}.mp4`;
            writeFileSync(video, Buffer.from(bytes));
            const swapped = withSampledAudio(video, `${OUT}/${name}-salamander.wav`);
            if (swapped) {
                files.push(swapped);
            }
        }
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(
            `${result.noteCount} notes, ${result.sampleCount} recordings ` +
                `(${(result.sampleBytes / 1_000_000).toFixed(1)} MB of WAV) in ${seconds}s`,
        );
        console.log(`  ${files.join("\n  ")}`);
    }
    await browser.close();
} finally {
    server.kill("SIGTERM");
    samples.close();
}
