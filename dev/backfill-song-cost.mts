// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Adds the per-song fingering `cost` to the shipped song manifest by recomputing it
// from each shipped .mxl with the same engine the import uses. The full import grades
// every PDMX candidate against the 30 GB source set; this only enriches the songs we
// already ship, so it needs no source data and runs in seconds. The import itself now
// writes `cost` too, so this is a one-off to populate the existing manifest.

import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { readFile, writeFile } from "node:fs/promises";

const { decompressMxl } = await import("../core/musicxmlFile.ts");

const DIR = "public/songs";

type Entry = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    license: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
};

const manifest: Entry[] = JSON.parse(await readFile(`${DIR}/manifest.json`, "utf8"));

const enriched = [];
let done = 0;
for (const song of manifest) {
    const bytes = await readFile(`${DIR}/${song.id}.mxl`);
    const xml = decompressMxl(new Uint8Array(bytes));
    const cost = xml ? Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3)) : 0;
    // Keep the field order the import writes, so a re-import yields an identical file.
    enriched.push({
        id: song.id,
        title: song.title,
        composer: song.composer,
        grade: song.grade,
        cost,
        license: song.license,
        tempo: song.tempo,
        beatsPerBar: song.beatsPerBar,
        bars: song.bars,
    });
    if (++done % 500 === 0) {
        console.log(`  ${done}/${manifest.length}`);
    }
}

await writeFile(`${DIR}/manifest.json`, JSON.stringify(enriched));
console.log(`Backfilled cost for ${enriched.length} songs.`);
