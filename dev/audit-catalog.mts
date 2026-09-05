// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Audits the shipped song catalogue for scores that don't belong in a *piano* app —
// drum kits, other solo instruments — and for the cost:0 entries that the piano
// fingering grader couldn't score (which are largely the same non-piano scores). It
// only REPORTS: it prints a breakdown and writes the flagged ids to
// dev/catalog-nonpiano.json, so removal is a separate, reviewable step.
//
// Run under tsx: `npx tsx dev/audit-catalog.mts`

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { copyrightReason } from "./copyrightSignals.mts";
import { nonPianoReason } from "./scoreInstrument.mts";

const APPLY = process.argv.includes("--apply");

const DIR = "public/songs";
type Song = { id: string; title: string; composer: string; grade: number; cost: number };
const manifest: Song[] = JSON.parse(readFileSync(`${DIR}/manifest.json`, "utf8"));

// A score sits under its licence bucket — public/songs/<spdx>/<id>.mxl — so the path has
// to be found rather than assumed. Reading `${DIR}/<id>.mxl` directly, as this did until
// the buckets arrived, throws for every score in the catalogue and reports the whole thing
// unreadable; an audit that flags everything is one nobody reads, which is how seven
// tablature scores sat here unnoticed.
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

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMusicXml(id: string): string {
    const xml = decompressMxl(new Uint8Array(readFileSync(scorePath(id))));
    if (xml === null) {
        throw new Error(`no rootfile in ${scorePath(id)}`);
    }
    return xml;
}

const flagged: { id: string; title: string; reason: string }[] = [];
const byReason: Record<string, number> = {};
let cost0 = 0;
let unreadable = 0;

for (const song of manifest) {
    if (song.cost === 0) {
        cost0++;
    }
    // Copyright signal lives in the metadata — no need to open the .mxl.
    const copyright = copyrightReason(song.composer);
    if (copyright) {
        flagged.push({ id: song.id, title: song.title, reason: `copyright (${copyright})` });
        byReason.copyright = (byReason.copyright ?? 0) + 1;
    }
    let xml: string;
    try {
        xml = readMusicXml(song.id);
    } catch {
        unreadable++;
        flagged.push({ id: song.id, title: song.title, reason: "unreadable" });
        byReason.unreadable = (byReason.unreadable ?? 0) + 1;
        continue;
    }
    const reason = nonPianoReason(xml);
    if (reason) {
        flagged.push({ id: song.id, title: song.title, reason });
        byReason[reason] = (byReason[reason] ?? 0) + 1;
    }
}

writeFileSync("dev/catalog-flagged.json", `${JSON.stringify(flagged, null, 2)}\n`);

console.log(`Catalogue: ${manifest.length} songs`);
console.log(`Flagged (non-piano / copyright / unreadable): ${flagged.length}`);
console.log("  by reason:", byReason);
console.log(`cost:0 entries: ${cost0}`);
console.log(`unreadable .mxl: ${unreadable}`);
console.log("\nSample flagged:");
for (const f of flagged.slice(0, 20)) {
    console.log(`  [${f.reason}] ${f.title}`);
}
console.log("\nWrote dev/catalog-nonpiano.json");

// With --apply: drop the flagged scores from the manifest and delete their .mxl, so
// the wrong-instrument (and the copyrighted drum covers among them) leave the catalogue.
if (APPLY && flagged.length > 0) {
    const drop = new Set(flagged.map((f) => f.id));
    const kept = manifest.filter((song) => !drop.has(song.id));
    for (const f of flagged) {
        // The score sits in its licence directory, where scorePath finds it; a path that is
        // not there is a removal that did not happen.
        rmSync(scorePath(f.id));
    }
    writeFileSync(`${DIR}/manifest.json`, JSON.stringify(kept));
    console.log(`APPLIED: removed ${flagged.length} scores; manifest now ${kept.length}.`);
}
