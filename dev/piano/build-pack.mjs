// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Encodes the Salamander library for the web: every recording, whole, one file each, with
// a manifest the app plays from.
//
// It is NOT an archive anybody downloads. All sixteen velocity layers at their natural
// length come to about 150 MB, and the instrument is never fetched as a unit: a piece
// needs a dozen or so recordings, the app knows which ones before it plays a note, and
// each one is a URL a cache keeps for good. So the size that matters is what a session
// costs, not what the library weighs — and the way to make a session cheap is to leave the
// recordings alone rather than to compromise them.
//
// Nothing is truncated. The obvious saving is not there to take: the library's author
// already trimmed these files, so there is no trailing silence to find — measured at every
// threshold from −40 to −60 dBFS, not one recording had any. Cutting is therefore a
// deliberate fade over audible decay, and a bass string that rings for twenty-five seconds
// rings that long because that is what it does. The velocity mapping, key spans, release
// noises and string resonances are the library's own, so what the app plays is what the
// SFZ describes rather than an interpretation of it.
//
// Usage: node dev/piano/build-pack.mjs --library <dir> [--out dir] [--bitrate 96]
//
// The output is what gets uploaded; nothing here is committed. Salamander Grand Piano V3
// by Alexander Holm, CC-BY-3.0 — the licence travels in the manifest and is shown in the
// app beside the instrument.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readSfz, readSfzExtras } from "./salamander.mjs";

const LIBRARY = argValue("--library");
const OUT = argValue("--out") ?? "piano-pack";
const BITRATE = Number(argValue("--bitrate") ?? 96);
// The version in the path. A pack is immutable once uploaded: the app caches it by URL and
// a changed encoding under an unchanged name is the one thing a cache cannot notice.
const VERSION = argValue("--version") ?? "v1";

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

if (!LIBRARY || !existsSync(LIBRARY)) {
    console.error("Pass --library <dir> holding SalamanderGrandPianoV3.sfz");
    process.exit(1);
}

const sfz = join(LIBRARY, "SalamanderGrandPianoV3.sfz");
const notes = readSfz(sfz);
const extras = readSfzExtras(sfz);
const outDir = join(OUT, VERSION);
mkdirSync(outDir, { recursive: true });

// One name per source recording, flattened: the library's own file name, with the sharp
// spelled out. A `#` in a URL is the start of a fragment, and a pack served from object
// storage is nothing but URLs.
function webName(file) {
    return `${basename(file, ".wav").replace(/#/g, "s")}.opus`;
}

function encode(file) {
    const out = join(outDir, webName(file));
    const run = spawnSync(
        "ffmpeg",
        [
            "-y",
            "-loglevel",
            "error",
            "-i",
            file,
            "-c:a",
            "libopus",
            "-b:a",
            `${BITRATE}k`,
            // Opus tunes itself for speech by default, which is the wrong instrument.
            "-application",
            "audio",
            out,
        ],
        { stdio: "inherit" },
    );
    if (run.status !== 0) {
        throw new Error(`ffmpeg failed on ${file}`);
    }
    return statSync(out).size;
}

let bytes = 0;
let count = 0;
const encoded = new Map();
function once(file) {
    if (!encoded.has(file)) {
        bytes += encode(file);
        count += 1;
        encoded.set(file, webName(file));
        if (count % 100 === 0) {
            process.stdout.write(`  ${count} encoded, ${(bytes / 1_000_000).toFixed(1)} MB\n`);
        }
    }
    return encoded.get(file);
}

console.log(`${notes.length} note regions, ${extras.length} release regions → ${outDir}`);

const manifest = {
    // What this is and what is owed for it. The app shows this beside the instrument; a
    // pack that travels without its licence is a pack that cannot be shipped.
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html",
    version: VERSION,
    format: "opus",
    bitrateKbps: BITRATE,
    notes: notes.map((region) => ({
        file: once(region.file),
        keyCentre: region.keyCentre,
        lowKey: region.lowKey,
        highKey: region.highKey,
        lowVelocity: region.lowVelocity,
        highVelocity: region.highVelocity,
    })),
    // Key-off noise and the string resonance a released key leaves behind. Small, and the
    // difference between a sampled piano and a recording of one.
    releases: extras.map((region) => ({
        file: once(region.file),
        keyCentre: region.keyCentre,
        lowKey: region.lowKey,
        highKey: region.highKey,
        lowVelocity: region.lowVelocity,
        highVelocity: region.highVelocity,
        kind: region.kind,
        decay: region.decay,
    })),
};

const json = JSON.stringify(manifest, null, 2);
writeFileSync(join(outDir, "manifest.json"), `${json}\n`);
const digest = createHash("sha256").update(json).digest("hex").slice(0, 12);
writeFileSync(
    join(OUT, "README.txt"),
    `Salamander Grand Piano V3 by Alexander Holm, CC-BY-3.0\n` +
        `${manifest.source}\n\n` +
        `Encoded for Plinky: Opus ${BITRATE} kb/s, whole recordings, one file each.\n` +
        `${count} files, ${(bytes / 1_000_000).toFixed(1)} MB, manifest ${digest}\n`,
);

console.log(
    `${count} files, ${(bytes / 1_000_000).toFixed(1)} MB (manifest ${digest}) — upload ${outDir}/ as ${VERSION}/\n` +
        "Nobody downloads that: a piece fetches the dozen or so recordings it needs.",
);
