// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adds the per-song fingering `cost` to the shipped song manifest by recomputing it
// from each shipped .mxl with the same engine the import uses. The full import grades
// every PDMX candidate against the 30 GB source set; this only enriches the songs we
// already ship, so it needs no source data and runs in seconds. The import itself now
// writes `cost` too, so this is a one-off to populate the existing manifest.

import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { existsSync, readdirSync } from "node:fs";
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

// A score sits under its licence bucket — public/songs/<spdx>/<id>.mxl — so the path is
// found, not assumed. Reading `${DIR}/<id>.mxl` throws for every score in the catalogue.
function scorePath(id: string): string {
    for (const bucket of readdirSync(DIR, { withFileTypes: true })) {
        if (bucket.isDirectory()) {
            const path = `${DIR}/${bucket.name}/${id}.mxl`;
            if (existsSync(path)) {
                return path;
            }
        }
    }
    throw new Error(`no .mxl for ${id}`);
}

const enriched = [];
let done = 0;
for (const song of manifest) {
    const bytes = await readFile(scorePath(song.id));
    const xml = decompressMxl(new Uint8Array(bytes));
    const cost = xml ? Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3)) : 0;
    // Spread, not a field list. Listing them kept the import's field order and silently
    // dropped everything the list did not know about: running this erased the baked
    // incipit from all 2,952 pieces that had one, and would now take `source`, `kind` and
    // `credit` with it. A script that rewrites every row must carry what it does not
    // understand — the only field it has any business changing is the one it computes.
    enriched.push({ ...song, cost });
    if (++done % 500 === 0) {
        console.log(`  ${done}/${manifest.length}`);
    }
}

await writeFile(`${DIR}/manifest.json`, JSON.stringify(enriched));
console.log(`Backfilled cost for ${enriched.length} songs.`);
