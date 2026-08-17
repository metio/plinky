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
import {
    createWriteStream,
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
} from "node:fs";
import { chromium } from "playwright";

const OUT = argValue("--out") ?? "promo";
const SECONDS = Number(argValue("--seconds") ?? 20);
const SIZE = Number(argValue("--size") ?? 1080);
// YouTube wants a landscape frame and the whole piece rather than a feed's twenty seconds.
// The painter keeps the waterfall over the keyboard at any aspect that is not taller than
// it is wide, so this is a shape and a length, not a second renderer.
const YOUTUBE = process.argv.includes("--youtube");
const WIDTH = YOUTUBE ? 1920 : SIZE;
const HEIGHT = YOUTUBE ? 1080 : SIZE;
const FPS = 30;
// The looks these clips use, named from core/videoLook — the same choices the export
// panel offers a player, so nothing here is a palette of its own. Colouring by finger is
// fixed across every clip: a viewer who watches two of them learns that the red notes are
// the thumb, and that only holds while the mapping never moves.
const NOTE_COLOR = "finger";
// The recorded piano, unless asked for the synthesised one. A clip is the first time most
// people hear Plinky, and the instrument it advertises should be the good one.
const SAMPLES = process.argv.includes("--synth")
    ? undefined
    : (argValue("--samples") ?? "https://samples.plinky.fun/v1");
const KEYBOARD_DEPTH = "shallow";
const PORT = 5199;
// Render only the pieces whose title contains this, for a re-run of one clip.
const ONLY = argValue("--only");
// Pick up where a previous run stopped, rather than re-rendering an hour of finished
// clips. A whole-catalogue batch takes long enough that something will interrupt it —
// a machine that goes to sleep, a stray edit that trips the dev server's own config
// watcher — and re-running from the top is a poor answer to any of them.
const RESUME = process.argv.includes("--resume");

// The pieces worth leading with: recognisable in three seconds, and CC0, so nothing is
// owed by a post that carries only the picture. Ids are content fingerprints, so a
// re-import that changes the notes changes the id and this list stops matching — which is
// the failure we want (a missing piece), not a silently different one. A piece that fails
// to render is reported and skipped, so one bad score does not cost the whole run.
const PIECES = [
    { id: "TOBNVaraGATl", title: "Gymnopédie No. 1", composer: "Erik Satie" },
    { id: "peJ0t6fhDKjp", title: "Gnossienne No. 1", composer: "Erik Satie" },
    { id: "VYBNsVqZzqa9", title: "Valses distinguées No. 2", composer: "Erik Satie" },
    { id: "yORzpFl5Dpfi", title: "Prelude in C, BWV 846", composer: "J. S. Bach" },
    { id: "GFdSJIBHjLm1", title: "Canon in D", composer: "Johann Pachelbel" },
    { id: "OlYvqHsXwB63", title: "Für Elise", composer: "Ludwig van Beethoven" },
    { id: "8EKlMBPOS5dj", title: "The Entertainer", composer: "Scott Joplin" },
    { id: "zCR5qNmpjcYD", title: "Solace", composer: "Scott Joplin" },
    { id: "3hknjVHy3gan", title: "Clair de lune", composer: "Claude Debussy" },
    { id: "8p8IBmci1d2l", title: "Première arabesque", composer: "Claude Debussy" },
    { id: "0nlCL3JvtjCl", title: "Nocturne in C-sharp minor", composer: "Frédéric Chopin" },
    { id: "gZKH4xnshzeG", title: "Fantaisie-impromptu, Op. 66", composer: "Frédéric Chopin" },
    { id: "GwgHLdwI1tJU", title: "Nocturnes, Op. 9", composer: "Frédéric Chopin" },
    { id: "9OmWzgIPdNFd", title: "Nocturnes, Op. 27", composer: "Frédéric Chopin" },
    { id: "y93KGmDQoD12", title: "Nocturne in E minor, Op. 72 No. 1", composer: "Frédéric Chopin" },
    { id: "wx8UhU1HozEL", title: "Waltzes, Op. 64", composer: "Frédéric Chopin" },
    { id: "8f3TJUVUEjfo", title: "Waltzes, Op. 69", composer: "Frédéric Chopin" },
    { id: "SvMHyl2yF7YS", title: "Waltz in A minor, B. 150", composer: "Frédéric Chopin" },
    { id: "YG1UemgwoxnB", title: "Wedding March", composer: "Felix Mendelssohn" },
    { id: "yxW1jGFJPEcF", title: "Anitra's Dance", composer: "Edvard Grieg" },
    { id: "GGAHdvH4ToTQ", title: "Peer Gynt, Op. 23", composer: "Edvard Grieg" },
    { id: "TaKfOgLMeIML", title: "L'arabesque", composer: "Friedrich Burgmüller" },
    { id: "mimKg0nWHBhC", title: "Rêverie", composer: "Augusta Holmès" },
    { id: "9lEEckSFDs5p", title: "Ave Maria", composer: "Franz Schubert" },
    { id: "voMStN2RqgVX", title: "Ave Maria", composer: "Bach / Gounod" },
    { id: "sHg7w3g0Ftdp", title: "Minuet in G, BWV Anh. 114", composer: "J. S. Bach" },
    { id: "XnWdH7iBpFxq", title: "Minuet in F, BWV Anh. 113", composer: "J. S. Bach" },
    { id: "VktWWxpyGanX", title: "Three Minuets, BWV 841–843", composer: "J. S. Bach" },
    { id: "bZUPLkmV2Sso", title: "Invention No. 2", composer: "J. S. Bach" },
    { id: "FSDn0qToFT6V", title: "Invention No. 4", composer: "J. S. Bach" },
    { id: "ArKsvazw6Ofb", title: "Invention No. 8", composer: "J. S. Bach" },
    { id: "YhKornCQUYEZ", title: "Invention No. 13", composer: "J. S. Bach" },
    { id: "mE1ACsw4hInO", title: "Invention in A minor, BWV 784", composer: "J. S. Bach" },
    { id: "GU05sH6kjHJv", title: "English Suite II: Bourrée I", composer: "J. S. Bach" },
    { id: "WnXMoVJk3TIQ", title: "Ich ruf zu dir, BWV 639", composer: "J. S. Bach" },
    { id: "9HqvitzGxsvD", title: "Sonatina, Op. 36 No. 1", composer: "Muzio Clementi" },
    { id: "aDxFLZmRT3qy", title: "Sonatina No. 1", composer: "Muzio Clementi" },
    { id: "dkPRbyhkMLiF", title: "Sonatina, Op. 20 No. 1", composer: "Friedrich Kuhlau" },
    { id: "KFCmkxaetLyO", title: "Sonatina in A minor", composer: "Carl Reinecke" },
    { id: "Kt5xcTPhESM3", title: "Sonatina in B-flat", composer: "G. F. Handel" },
    { id: "k28L80FWNSJ9", title: "Two Sonatinas, Anh. 5", composer: "Ludwig van Beethoven" },
    { id: "b8W3vrVR06Qo", title: "Minuet in F, K. 2", composer: "W. A. Mozart" },
    { id: "pzU8jLSS1NiJ", title: "Minuet in G, K. 1", composer: "W. A. Mozart" },
    { id: "dsHMfT7I5i1I", title: "Minuet in D, K. 94", composer: "W. A. Mozart" },
    { id: "NnDvYcpB6R21", title: "Nocturne in E-flat, H 56", composer: "John Field" },
    { id: "hqSbXf4vgnLA", title: "Nocturne in E minor, H 46", composer: "John Field" },
    { id: "qzVZUx1FcKyp", title: "Nocturne No. 6, Op. 63", composer: "Gabriel Fauré" },
    { id: "Aix9APzSrM7I", title: "Nocturne in A-flat, WoO 3", composer: "Alexander Scriabin" },
    { id: "Lp3pYHl18Ocf", title: "Waltz, Op. 51 No. 6", composer: "Pyotr Tchaikovsky" },
    { id: "fGOO8pHm0qaE", title: "Waltz No. 10", composer: "Johannes Brahms" },
    { id: "DpPqnXtsbCvC", title: "Twenty-four Waltzes, Op. 32", composer: "Carl Czerny" },
    { id: "DzNX5Qf8cKgs", title: "Fairy Lullaby", composer: "Amy Beach" },
    { id: "ARc0pONVwLU4", title: "Greensleeves", composer: "Traditional" },
    { id: "uzo6hVxZYnuI", title: "Amazing Grace", composer: "Traditional" },
    { id: "pwhwiOvdnR0K", title: "Danny Boy", composer: "Traditional" },
];

// Headless Chromium has no AAC encoder — it is licensed, and plain Chromium ships
// without it — so the app's exporter falls back to Opus, which is legal in an MP4 and
// plays everywhere except the one place these clips are going. Instagram's ingest expects
// AAC. The picture is left exactly as encoded and only the sound is recoded, so nothing
// the painter drew is touched.
//
// The sound is brought to the loudness a feed plays at while it is being recoded. The
// recorded piano plays the dynamics that are written — Gymnopédie is marked lent et
// douloureux and comes out quiet, correctly — and a feed does not care why a clip is
// quieter than the one before it. Normalising the post rather than the instrument keeps the
// piano honest in the app and the clip audible where it is watched.
function toAac(file) {
    const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (probe.error) {
        console.warn("  ffmpeg not found: leaving Opus audio, which Instagram may reject");
        return;
    }
    const temp = `${file}.aac.mp4`;
    const run = spawnSync(
        "ffmpeg",
        [
            "-y", "-loglevel", "error",
            "-i", file,
            "-c:v", "copy",
            // Instagram plays at about -14 LUFS; anything quieter is turned up by the
            // platform anyway, and unevenly.
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-ar", "48000",
            "-c:a", "aac", "-b:a", "256k",
            temp,
        ],
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
// The file a piece is written to. Two pieces can share a title — the catalogue holds a
// Schubert Ave Maria and a Bach/Gounod one — and a bare title slug would have the second
// silently overwrite the first, so a repeated title takes its composer along.
function fileFor(piece, out) {
    const shares = PIECES.filter((other) => other.title === piece.title).length > 1;
    const name = shares ? `${slug(piece.title)}-${slug(piece.composer)}` : slug(piece.title);
    return `${out}/${name}.mp4`;
}

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

// The dev server is here only to compile modules for the browser; nothing is being edited
// while a render runs, and a watcher would reload the page mid-frame the moment anything in
// the tree changed. An hour-long batch should not be hostage to a stray save.
const server = spawn("npx", ["react-router", "dev", "--port", String(PORT)], {
    stdio: "inherit",
    env: { ...process.env, PLINKY_NO_WATCH: "1" },
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
    // The finished video comes back a megabyte at a time, straight to disk.
    //
    // It used to cross as one Array.from(bytes), which turns a video into a JS array of a
    // few million numbers and then JSON on both sides of the bridge. A twenty-second clip
    // survives that; a whole piece is several times the size and killed node with a heap
    // OOM partway through the batch. Streaming it bounds the memory at one chunk, however
    // long the piece.
    let sink = null;
    await page.exposeFunction("__promoChunk", (encoded) => {
        sink?.write(Buffer.from(encoded, "base64"));
    });
    page.on("console", (message) => {
        if (message.type() === "error") {
            console.error("  browser:", message.text());
        }
    });
    await page.goto(`${base}/en/`, { waitUntil: "domcontentloaded" });

    let failed = 0;
    let skipped = 0;
    for (const piece of PIECES) {
        if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) {
            continue;
        }
        if (RESUME && existsSync(fileFor(piece, OUT))) {
            skipped += 1;
            continue;
        }
        process.stdout.write(`${piece.title} … `);
        try {
        const { url, song } = scoreUrl(piece.id, manifest);
        const started = Date.now();
        const file = fileFor(piece, OUT);
        sink = createWriteStream(file);
        const size = await page.evaluate(
            async (request) => {
                const module = await import("/dev/promo/renderPromo.ts");
                const data = await module.renderPromo(request);
                // A megabyte per message, and base64 built in small runs — spreading a
                // whole megabyte into String.fromCharCode overflows the argument stack.
                const CHUNK = 1 << 20;
                const RUN = 0x8000;
                for (let at = 0; at < data.length; at += CHUNK) {
                    const slice = data.subarray(at, at + CHUNK);
                    let binary = "";
                    for (let index = 0; index < slice.length; index += RUN) {
                        binary += String.fromCharCode(...slice.subarray(index, index + RUN));
                    }
                    await window.__promoChunk(btoa(binary));
                }
                return data.length;
            },
            {
                scoreUrl: url,
                title: piece.title,
                // No plinky.fun here: the wordmark already rides the top-right corner, and
                // the credit line is for what the catalogue owes the source.
                credit: `${piece.composer} · CC0`,
                width: WIDTH,
                height: HEIGHT,
                fps: FPS,
                // A whole piece for YouTube; a feed gets the opening.
                clipMs: YOUTUBE ? 0 : SECONDS * 1000,
                noteColor: NOTE_COLOR,
                keyboardDepth: KEYBOARD_DEPTH,
                samplesBase: SAMPLES,
            },
        );
        await new Promise((done) => sink.end(done));
        sink = null;
        toAac(file);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`${(size / 1_000_000).toFixed(1)} MB in ${seconds}s → ${file}`);
        void song;
        } catch (error) {
            failed += 1;
            // A piece that failed partway has a half-written file open on it; close it and
            // take it away, so a skipped clip is absent rather than truncated.
            if (sink) {
                const partial = sink.path;
                await new Promise((done) => sink.end(done));
                sink = null;
                rmSync(partial, { force: true });
            }
            console.log(`skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Named rather than folded into the total: a run that quietly reports "55/55" after
    // rendering eight of them reads as complete coverage when it is not.
    const attempted = PIECES.length - skipped;
    console.log(
        `${attempted - failed}/${attempted} rendered into ${OUT}/` +
            (skipped > 0 ? `, ${skipped} already there` : ""),
    );
    await browser.close();
} finally {
    server.kill("SIGTERM");
}
