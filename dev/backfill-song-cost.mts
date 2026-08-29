// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adds the per-song fingering `cost` and `reach` to the shipped song manifest by
// recomputing both from each shipped .mxl with the same engine the import uses.
//
// `reach` is what the piece grades at with its inner notes taken out (core/simplify): a
// Grade 5 that is Grade 2 with the melody alone. It is measured here rather than in the
// browser because the answer is wanted while somebody is BROWSING — a list row saying a
// hard piece has a way in is the whole point, and there is no score loaded to measure at
// that moment. It is also slow: a quarter of a second on a small piece and close to two
// seconds on a big one, three times over for the three reductions, which is a batch job
// and not something to do behind a page. The full import grades
// every PDMX candidate against the 30 GB source set; this only enriches the songs we
// already ship, so it needs no source data and runs in seconds. The import itself now
// writes `cost` too, so this is a one-off to populate the existing manifest.

import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { reachableGrades, reachOf } from "../core/reach.ts";
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
    scoreKind?: string;
};

const manifest: Entry[] = JSON.parse(await readFile(`${DIR}/manifest.json`, "utf8"));

// Measure a handful and print them, writing nothing. The full pass rewrites every row of a
// file the rest of the tooling reads, so there has to be a way to see what it would produce
// without committing the catalogue to it.
const sampleAt = process.argv.indexOf("--sample");
const sample = sampleAt > 0 ? Number(process.argv[sampleAt + 1] ?? 10) : 0;

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

if (sample > 0) {
    const hard = manifest.filter((song) => song.scoreKind === "solo-piano" && song.grade >= 3);
    for (const song of hard.slice(0, sample)) {
        const bytes = await readFile(scorePath(song.id));
        const xml = decompressMxl(new Uint8Array(bytes));
        const found = xml ? reachableGrades(linkedomXmlCodec, song.id, xml) : [];
        const ways = found.map((way) => `${way.level} ${way.grade}`).join(", ");
        console.log(
            `  grade ${song.grade}  ${song.title.slice(0, 40).padEnd(40)} ${ways || "nothing to take out"}`,
        );
    }
    console.log(`\n  ${sample} of ${hard.length} solo-piano pieces at grade 3+. Nothing written.`);
    process.exit(0);
}

const enriched = [];
let done = 0;
for (const song of manifest) {
    const bytes = await readFile(scorePath(song.id));
    const xml = decompressMxl(new Uint8Array(bytes));
    const cost = xml ? Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3)) : 0;
    // Only where a reduction means anything. Thinning a singer's line is not an easier song
    // but a different one, and the ladder only ever offers solo piano anyway.
    const reach =
        xml && song.scoreKind === "solo-piano"
            ? reachOf(reachableGrades(linkedomXmlCodec, song.id, xml))
            : {};
    // Spread, not a field list. Listing them kept the import's field order and silently
    // dropped everything the list did not know about: running this erased the baked
    // incipit from all 2,952 pieces that had one, and would now take `source`, `kind` and
    // `credit` with it. A script that rewrites every row must carry what it does not
    // understand — the only field it has any business changing is the one it computes.
    // A piece nothing can be taken out of carries nothing, rather than an empty object in
    // three thousand rows of a file every visitor to the library downloads.
    enriched.push(Object.keys(reach).length > 0 ? { ...song, cost, reach } : { ...song, cost });
    if (++done % 500 === 0) {
        console.log(`  ${done}/${manifest.length}`);
    }
}

await writeFile(`${DIR}/manifest.json`, JSON.stringify(enriched));
console.log(`Backfilled cost for ${enriched.length} songs.`);
