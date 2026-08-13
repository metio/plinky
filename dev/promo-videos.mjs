// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders short promo clips of catalogue pieces, for posting.
//
// The app's video export runs in a browser — WebCodecs for the picture, an offline audio
// render for the sound — so this drives a headless Chromium against the dev server and
// asks it to run the app's own painter and encoder (dev/promo/renderPromo.ts). Nothing is
// reimplemented here: a clip that does not look like Plinky is not worth posting.
//
// Usage: npm run promo:videos [-- --out dir] [--seconds 20] [--size 1080]
//
// Only CC0 pieces are eligible. The catalogue's CC-BY and CC-BY-SA scores carry
// obligations that a social post strips: the credit line is burnt into every frame, but
// share-alike travels with the video, and a feed is the worst place to argue about it.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = argValue("--out") ?? "promo";
const SECONDS = Number(argValue("--seconds") ?? 20);
const SIZE = Number(argValue("--size") ?? 1080);
const FPS = 30;
// The looks these clips use, named from core/videoLook — the same choices the export
// panel offers a player, so nothing here is a palette of its own.
const NOTE_COLOR = "pink";
const KEYBOARD_DEPTH = "shallow";
const PORT = 5199;

// The pieces worth leading with: recognisable in three seconds, and CC0, so nothing is
// owed by a post that carries only the picture. Ids are content fingerprints, so a
// re-import that changes the notes changes the id and this list stops matching — which is
// the failure we want (a missing piece), not a silently different one.
const PIECES = [
    { id: "TOBNVaraGATl", title: "Gymnopédie No. 1", composer: "Erik Satie" },
    { id: "peJ0t6fhDKjp", title: "Gnossienne No. 1", composer: "Erik Satie" },
    { id: "yORzpFl5Dpfi", title: "Prelude in C, BWV 846", composer: "J. S. Bach" },
    { id: "GFdSJIBHjLm1", title: "Canon in D", composer: "Johann Pachelbel" },
    { id: "OlYvqHsXwB63", title: "Für Elise", composer: "Ludwig van Beethoven" },
    { id: "8EKlMBPOS5dj", title: "The Entertainer", composer: "Scott Joplin" },
];

// Headless Chromium has no AAC encoder — it is licensed, and plain Chromium ships
// without it — so the app's exporter falls back to Opus, which is legal in an MP4 and
// plays everywhere except the one place these clips are going. Instagram's ingest expects
// AAC. The picture is left exactly as encoded and only the sound is recoded, so nothing
// the painter drew is touched.
function toAac(file) {
    const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (probe.error) {
        console.warn("  ffmpeg not found: leaving Opus audio, which Instagram may reject");
        return;
    }
    const temp = `${file}.aac.mp4`;
    const run = spawnSync(
        "ffmpeg",
        ["-y", "-loglevel", "error", "-i", file, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", temp],
        { stdio: "inherit" },
    );
    if (run.status === 0) {
        renameSync(temp, file);
    } else {
        console.warn("  audio recode failed; leaving Opus");
    }
}

// A filename somebody can pick out of a folder: the piece, not its fingerprint. Accents
// and punctuation go, spaces become dashes — "Gymnopédie No. 1" becomes gymnopedie-no-1.
function slug(title) {
    return title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

// Where a score sits under public/songs — the licence bucket is part of the path, and the
// manifest does not carry it.
function scoreUrl(id, manifest) {
    const song = manifest.find((entry) => entry.id === id);
    if (!song) {
        throw new Error(`${id} is not in the manifest`);
    }
    if (song.license !== "CC0-1.0") {
        throw new Error(`${id} is ${song.license}, and only CC0 pieces may be posted`);
    }
    return { url: `/songs/${song.license.toLowerCase()}/${id}.mxl`, song };
}

async function waitForServer(url, attempts = 120) {
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`dev server never came up at ${url}`);
}

const manifest = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));
mkdirSync(OUT, { recursive: true });

const server = spawn("npx", ["react-router", "dev", "--port", String(PORT)], {
    stdio: "inherit",
    env: process.env,
});
const base = `http://localhost:${PORT}`;

try {
    await waitForServer(`${base}/en/`);
    const browser = await chromium.launch({
        // WebCodecs' hardware paths are absent in headless; the software encoders are what
        // the flags below keep available.
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
        const { url, song } = scoreUrl(piece.id, manifest);
        process.stdout.write(`${piece.title} … `);
        const started = Date.now();
        const bytes = await page.evaluate(
            async (request) => {
                const module = await import("/dev/promo/renderPromo.ts");
                const data = await module.renderPromo(request);
                return Array.from(data);
            },
            {
                scoreUrl: url,
                title: piece.title,
                // No plinky.fun here: the wordmark already rides the top-right corner, and
                // the credit line is for what the catalogue owes the source.
                credit: `${piece.composer} · CC0`,
                width: SIZE,
                height: SIZE,
                fps: FPS,
                clipMs: SECONDS * 1000,
                noteColor: NOTE_COLOR,
                keyboardDepth: KEYBOARD_DEPTH,
            },
        );
        const file = `${OUT}/${slug(piece.title)}.mp4`;
        writeFileSync(file, Buffer.from(bytes));
        toAac(file);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`${(bytes.length / 1_000_000).toFixed(1)} MB in ${seconds}s → ${file}`);
        void song;
    }
    await browser.close();
} finally {
    server.kill("SIGTERM");
}
