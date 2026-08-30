// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long each rendered clip actually runs — the picture, not the sound.
//
// The two are different, and the difference misleads. A piano sample rings on after the
// last frame, so the movie header — which reports the longer of the tracks — says a clip is
// about two seconds longer than it looks. Measuring that and comparing it to what the cut
// asked for reads as a bug that is not there, and hides one that is.
//
// Read straight out of the container rather than decoded, so this needs neither the H.264
// decoder the devshell's ffmpeg lacks nor a browser: it is the video track's own media
// header, which is the clip's length by definition.
//
// What it is for: the clips are cut at a musical silence inside a window rather than at a
// fixed length (core/clipEnd), so the only way to know a batch averages where it was asked
// to is to measure the batch. `npm run promo:cuts` predicts the same numbers without
// rendering; the two agreeing is the end-to-end check that the browser ran the code in the
// tree, which is not something a stamp beside the file can tell you.
//
// Usage: npm run promo:durations -- promo/*/*/feed.mp4

import { readFileSync } from "node:fs";

// The boxes directly inside [start, end), as [kind, bodyStart, boxEnd].
function* boxes(blob, start, end) {
    let at = start;
    while (at + 8 <= end) {
        let size = blob.readUInt32BE(at);
        const kind = blob.toString("latin1", at + 4, at + 8);
        let head = 8;
        if (size === 1) {
            // A 64-bit size, for a box larger than four gigabytes.
            size = Number(blob.readBigUInt64BE(at + 8));
            head = 16;
        } else if (size === 0) {
            size = end - at;
        }
        if (size < head) {
            return;
        }
        yield [kind, at + head, at + size];
        at += size;
    }
}

function* find(blob, start, end, path) {
    for (const [kind, body, stop] of boxes(blob, start, end)) {
        if (kind !== path[0]) {
            continue;
        }
        if (path.length === 1) {
            yield [body, stop];
        } else {
            yield* find(blob, body, stop, path.slice(1));
        }
    }
}

// Seconds per track, keyed by handler type: "vide" for the picture, "soun" for the sound.
function tracks(file) {
    const blob = readFileSync(file);
    const found = {};
    for (const [moov, moovEnd] of find(blob, 0, blob.length, ["moov"])) {
        for (const [trak, trakEnd] of find(blob, moov, moovEnd, ["trak"])) {
            let handler = "?";
            for (const [hdlr] of find(blob, trak, trakEnd, ["mdia", "hdlr"])) {
                handler = blob.toString("latin1", hdlr + 8, hdlr + 12);
            }
            for (const [mdhd] of find(blob, trak, trakEnd, ["mdia", "mdhd"])) {
                const version = blob[mdhd];
                const at = mdhd + 4 + (version === 1 ? 16 : 8);
                const scale = blob.readUInt32BE(at);
                const ticks =
                    version === 1
                        ? Number(blob.readBigUInt64BE(at + 4))
                        : blob.readUInt32BE(at + 4);
                if (scale > 0) {
                    found[handler] = ticks / scale;
                }
            }
        }
    }
    return found;
}

const rows = [];
for (const file of process.argv.slice(2)) {
    try {
        const { vide, soun } = tracks(file);
        if (vide === undefined) {
            console.error(`  no video track: ${file}`);
            continue;
        }
        rows.push({ file, video: vide, audio: soun });
    } catch (error) {
        console.error(`  ${file}: ${error?.message ?? error}`);
    }
}

rows.sort((a, b) => a.video - b.video);
for (const row of rows) {
    const ring = row.audio === undefined ? "" : ` (sound rings to ${row.audio.toFixed(1)}s)`;
    console.log(`  ${row.video.toFixed(1)}s  ${row.file.split("/").at(-2)}${ring}`);
}

if (rows.length > 0) {
    const lengths = rows.map((row) => row.video);
    const n = lengths.length;
    const median = n % 2 ? lengths[(n - 1) / 2] : (lengths[n / 2 - 1] + lengths[n / 2]) / 2;
    const mean = lengths.reduce((a, b) => a + b, 0) / n;
    console.log(
        `\n  ${n} clips | median ${median.toFixed(1)}s | mean ${mean.toFixed(1)}s | ` +
            `range ${lengths[0].toFixed(1)}-${lengths[n - 1].toFixed(1)}s`,
    );
}
