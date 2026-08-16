// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a downloadable Salamander pack would weigh, measured rather than guessed.
//
// The library is 1.2 GB of 44.1 kHz WAV across sixteen velocity layers. A browser wants
// the fewest layers an ear can't fault, encoded for the web, with the long tails cut —
// so this builds candidate packs at a few layer counts and reports what each one costs.
// The answer decides whether this ships as a download at all, and at how many tiers.
//
// Usage: node dev/piano/measure-pack.mjs --library <dir> [--bitrate 96] [--tail 6]

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSfz } from "./salamander.mjs";

const LIBRARY = argValue("--library");
const BITRATE = Number(argValue("--bitrate") ?? 96);
// Seconds of each recording to keep. A piano note is inaudible long before the file ends,
// and the tail is most of the bytes.
const TAIL = Number(argValue("--tail") ?? 6);

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

if (!LIBRARY || !existsSync(LIBRARY)) {
    console.error("Pass --library <dir> holding SalamanderGrandPianoV3.sfz");
    process.exit(1);
}

const regions = readSfz(join(LIBRARY, "SalamanderGrandPianoV3.sfz"));
const keys = [...new Set(regions.map((region) => region.keyCentre))].sort((a, b) => a - b);
const layersPerKey = new Map();
for (const region of regions) {
    const list = layersPerKey.get(region.keyCentre) ?? [];
    list.push(region);
    layersPerKey.set(region.keyCentre, list);
}
console.log(`${keys.length} sampled keys, ${regions.length} recordings in the library`);

// Which of the sixteen layers to keep for a pack of N. Spread across the velocity range
// rather than evenly by index: the layers are not evenly spaced in velocity, and the ear
// cares about the ends.
function chosen(list, count) {
    const sorted = [...list].sort((a, b) => a.lowVelocity - b.lowVelocity);
    if (count >= sorted.length) {
        return sorted;
    }
    if (count <= 1) {
        // One layer means one dynamic for the whole instrument; the middle of the range is
        // the least wrong place to take it from.
        return [sorted[Math.floor(sorted.length / 2)]];
    }
    return Array.from({ length: count }, (_, index) => {
        const at = Math.round((index * (sorted.length - 1)) / (count - 1));
        return sorted[at];
    });
}

const work = mkdtempSync(join(tmpdir(), "plinky-pack-"));
try {
    console.log(`\nOpus ${BITRATE} kb/s, first ${TAIL}s of each recording:\n`);
    console.log("  layers   files      pack size   per key");
    for (const count of [1, 3, 4, 5, 8, 16]) {
        let bytes = 0;
        let files = 0;
        for (const key of keys) {
            for (const region of chosen(layersPerKey.get(key) ?? [], count)) {
                const out = join(work, `${files}.opus`);
                const run = spawnSync(
                    "ffmpeg",
                    [
                        "-y", "-loglevel", "error",
                        "-t", String(TAIL),
                        "-i", region.file,
                        "-c:a", "libopus", "-b:a", `${BITRATE}k`,
                        out,
                    ],
                    { stdio: "inherit" },
                );
                if (run.status !== 0) {
                    throw new Error(`ffmpeg failed on ${region.file}`);
                }
                bytes += statSync(out).size;
                files += 1;
                rmSync(out);
            }
        }
        const mb = (bytes / 1_000_000).toFixed(1);
        const perKey = (bytes / keys.length / 1000).toFixed(0);
        console.log(
            `  ${String(count).padStart(6)}   ${String(files).padStart(5)}   ${mb.padStart(9)} MB   ${perKey.padStart(5)} KB`,
        );
    }
} finally {
    rmSync(work, { recursive: true, force: true });
}
