// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders short promo clips of catalogue pieces, for posting.
//
// The app's video export runs in a browser — WebCodecs for the picture, an offline audio
// render for the sound — so this drives a headless Chromium against the dev server and
// asks it to run the app's own painter and encoder (dev/promo/renderPromo.ts). Nothing is
// reimplemented here: a clip that does not look like Plinky is not worth posting.
//
// Usage: npm run promo:videos [-- --out dir] [--seconds 20] [--size 1080] [--fps 60]
//        [--youtube] landscape 1920x1080, the whole piece · [--shorts] portrait 1080x1920
// With no shape flag it renders 1080x1350, the 4:5 both Instagram and Facebook recommend.
//                             [--youtube] [--only text] [--resume] [--synth]
//                             [--collections] every named work · [--longest-first]
//
// Everything lands under promo/<composer>/<piece>/: feed.mp4 from a plain run, short.mp4
// from --shorts, youtube.mp4 from --youtube, and thumb.png from npm run promo:thumbs.
//
// Only CC0 pieces are eligible. The catalogue's CC-BY and CC-BY-SA scores carry
// obligations that a social post strips: the credit line is burnt into every frame, but
// share-alike travels with the video, and a feed is the worst place to argue about it.

import { spawnSync } from "node:child_process";
import {
    createWriteStream,
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { chromium } from "playwright";
import { folderFor, PIECES } from "./promo/pieces.mjs";
import { renderStamp } from "./promo/renderStamp.mjs";
import { startDevServer } from "./promo/devServer.mjs";
import { collectionPieces } from "./promo/collections.mjs";

const OUT = argValue("--out") ?? "promo";
const SECONDS = Number(argValue("--seconds") ?? 20);
const SIZE = Number(argValue("--size") ?? 1080);
// YouTube wants a landscape frame and the whole piece rather than a feed's twenty seconds.
// The painter keeps the waterfall over the keyboard at any aspect that is not taller than
// it is wide, so this is a shape and a length, not a second renderer.
const YOUTUBE = process.argv.includes("--youtube") || process.argv.includes("--collections");
// A Short is the same clip stood on its end. YouTube takes the square reel as one, but a
// phone is 9:16 and a square uses barely half of it — and the painter has a real portrait
// composition rather than a letterboxed landscape: taller than wide, it drops the keyboard
// and gives the whole height to the notation, which is what keeps the glyphs readable at
// arm's length. Feed length rather than the full piece, because a Short is a feed.
const SHORTS = process.argv.includes("--shorts");
// The default shape is the one a feed actually wants, 4:5 — there is no flag for it
// because it is what you get when you ask for neither of the other two.
//
// It replaced a square, which was never chosen: the original tooling took a --size and
// height fell back to the width, so 1:1 is simply what you get when nobody picks an
// aspect. The name made it worse — reel.mp4 was the one file in the folder that is not a
// reel shape, while short.mp4 is. And against the four places these are posted, 1:1 is
// second-best everywhere and first-choice nowhere: Instagram and Facebook both recommend
// 4:5 for a feed post, Reels and Stories want 9:16, YouTube wants 16:9.
//
// The painter needs nothing for it. It drops the keyboard in a tall frame only when a
// NOTATION PANEL is there to fill the stage instead, and a promo clip carries none, so the
// keys stay at every aspect.
// H.264 encodes in 4:2:0, where each chroma sample covers two pixels each way, so both
// sides have to be even. The defaults are; an odd --size is not, and the portrait height
// derived from one is odd for its own reasons — 500 gives 889. Rounding down by one is
// invisible and the alternative is an encoder that refuses the frame.
const even = (value) => value - (value % 2);
const WIDTH = even(YOUTUBE ? 1920 : SIZE);
const HEIGHT = even(
    YOUTUBE ? 1080 : SHORTS ? Math.round((SIZE * 16) / 9) : Math.round((SIZE * 5) / 4),
);
// The falling-notes highway is continuous motion, so frames are where its quality lives.
// 60 is the ceiling rather than a preference: core/videoEncoding.ts tops out at H.264
// level 4.2, which covers 1080p60 exactly and nothing beyond it — a limit chosen so an
// exported video hardware-decodes wherever it is shared, which is not a trade worth
// reversing for a clip. The bitrate follows the pixel rate on its own, so asking for more
// frames asks for more bits without a second dial.
const FPS = Number(argValue("--fps") ?? 60);
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
// The dev server this run drives. Overridable so a one-off clip can be rendered beside a
// long batch without the two ever sharing a server — which is the thing startDevServer
// refuses, and rightly: a driver that talks to somebody else's server renders somebody
// else's code. Separate ports, separate servers, no overlap.
const PORT = Number(argValue("--port") ?? 5199);
// Render only the pieces whose title contains this, for a re-run of one clip.
const ONLY = argValue("--only");
// Render the named works instead of the curated shelf: every CC0 piece of every built-in
// assignment, so each collection can go up as a playlist somebody can work through without
// ever opening Plinky. Full length only is the point there — a twenty-five-second cut of a
// study teaches nobody anything — so this implies --youtube.
const COLLECTIONS = process.argv.includes("--collections");
// Pick up where a previous run stopped, rather than re-rendering an hour of finished
// clips. A whole-catalogue batch takes long enough that something will interrupt it —
// a machine that goes to sleep, a stray edit that trips the dev server's own config
// watcher — and re-running from the top is a poor answer to any of them.
const RESUME = process.argv.includes("--resume");
// Render the long pieces before the short ones.
//
// A full-length batch is measured in hours and something always stops it — a machine that
// sleeps, an edit that invalidates the stamps, an evening that ends. What survives an
// interruption is whatever finished, so the order decides what a half-run is worth: longest
// first spends the certain time on the clips that cost the most to come back to, and leaves
// the two-minute studies as the cheap remainder. Shortest first would do the opposite.
const LONGEST_FIRST = process.argv.includes("--longest-first");

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
            "-y",
            "-loglevel",
            "error",
            "-i",
            file,
            "-c:v",
            "copy",
            // Instagram plays at about -14 LUFS; anything quieter is turned up by the
            // platform anyway, and unevenly.
            "-af",
            "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-ar",
            "48000",
            "-c:a",
            "aac",
            "-b:a",
            "256k",
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

// Both cuts of a piece sit in its own folder, named for what they are rather than for the
// piece — the folder already says which piece it is. The shape and the length are the only
// difference between them, so the names are the only place that distinction is recorded.
function fileFor(piece, out) {
    const dir = `${out}/${folderFor(piece)}`;
    mkdirSync(dir, { recursive: true });
    return `${dir}/${YOUTUBE ? "youtube" : SHORTS ? "short" : "feed"}.mp4`;
}

// What the code that renders a clip currently hashes to. Written beside each finished clip
// so --resume can tell one it made from one an older version made.
const STAMP = renderStamp();

function stampFor(piece, out) {
    return `${fileFor(piece, out)}.stamp`;
}

// Whether the clip already on disk was rendered by this code.
//
// "The file exists" is not that claim, and believing it was expensive: a batch that ran
// across an edit — or one resumed the next day against a changed cut — kept every clip it
// already had, and the difference showed up only in the video. Modification times do not
// settle it either; they say when a file was written, not what wrote it.
function alreadyRendered(piece, out) {
    const file = fileFor(piece, out);
    if (!existsSync(file)) {
        return false;
    }
    try {
        return readFileSync(stampFor(piece, out), "utf8").trim() === STAMP;
    } catch {
        // No stamp at all: rendered before stamping existed, so it cannot be vouched for.
        return false;
    }
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

const manifest = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));
mkdirSync(OUT, { recursive: true });

// Every piece is looked up before anything renders, and what cannot be found is named
// together, up front. The ids are content fingerprints: a re-import that changes a score's
// notes changes its id, and one pruned from the catalogue takes its id with it — so this
// list going stale is expected, and it is meant to show as a missing piece rather than a
// silently different one. What it must not do is show forty minutes in, one line at a
// time, buried under the clips that did work.
// The curated shelf, or every CC0 piece of every named work.
const chosen = ordered(COLLECTIONS ? collectionPieces() : PIECES);

// Roughly how long a piece plays, in seconds, from what the manifest already records.
//
// Only ever compared against another piece's, so the approximation is the right one: bars at
// the written tempo, ignoring repeats, rubato and the ritardando at the end. Those move a
// piece's real length by a fraction and its rank against a piece twice its size by nothing.
// The alternative is reading every score to sort the list, which is the batch itself.
function playingSeconds(piece) {
    const song = manifest.find((entry) => entry.id === piece.id);
    if (!song?.bars || !song.beatsPerBar || !song.tempo) {
        return 0;
    }
    return (song.bars * song.beatsPerBar * 60) / song.tempo;
}

function ordered(pieces) {
    return LONGEST_FIRST
        ? [...pieces].sort((a, b) => playingSeconds(b) - playingSeconds(a))
        : pieces;
}

const unresolved = chosen
    .map((piece) => {
        try {
            scoreUrl(piece.id, manifest);
            return null;
        } catch (error) {
            return `  ${piece.title} (${piece.id}): ${error instanceof Error ? error.message : error}`;
        }
    })
    .filter(Boolean);
if (unresolved.length > 0) {
    console.warn(
        `${unresolved.length} of ${chosen.length} pieces cannot be rendered:\n${unresolved.join("\n")}\n` +
            (COLLECTIONS
                ? "Re-run `npm run songs:bake` — the collections are resolved from the manifest."
                : "Fix dev/promo/pieces.mjs — a pruned piece needs removing, a re-imported one needs its new id."),
    );
}

// The dev server is here only to compile modules for the browser; nothing is being edited
// while a render runs, and a watcher would reload the page mid-frame the moment anything in
// the tree changed. An hour-long batch should not be hostage to a stray save.
//
// It must be OUR server: the browser gets its code from whichever process holds the port,
// so a stale one left running renders stale clips under a current stamp.
const server = await startDevServer(PORT);
const base = `http://localhost:${PORT}`;

try {
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
    // Pieces --only asked not to render. Counted apart from the ones already on disk,
    // because both are "not attempted" and only one of them means the batch is done.
    let filtered = 0;
    // A piece that fails to render is reported and skipped, so one bad score does not cost
    // the whole run.
    for (const piece of chosen) {
        if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) {
            filtered += 1;
            continue;
        }
        if (RESUME && alreadyRendered(piece, OUT)) {
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
                    //
                    // And no licence line. Every promo piece is CC0 — scoreUrl refuses anything
                    // else — and CC0 asks for no attribution at all, so naming the licence on a
                    // clip spends a line saying nothing is owed. A player's own export still
                    // carries it, because their piece may be CC-BY or CC-BY-SA, where the notice
                    // has to travel with the file.
                    credit: piece.composer,
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
            // Only once the clip is complete and recoded: a stamp beside a half-written
            // file would vouch for it.
            writeFileSync(stampFor(piece, OUT), `${STAMP}\n`);
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
                rmSync(stampFor(piece, OUT), { force: true });
            }
            console.log(`skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Named rather than folded into the total: a run that quietly reports "55/55" after
    // rendering eight of them reads as complete coverage when it is not.
    const attempted = chosen.length - skipped - filtered;
    console.log(
        `${attempted - failed}/${attempted} rendered into ${OUT}/` +
            (skipped > 0 ? `, ${skipped} already there` : "") +
            (filtered > 0 ? `, ${filtered} not asked for` : ""),
    );
    await browser.close();
} finally {
    server.kill("SIGTERM");
}
