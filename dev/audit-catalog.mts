// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Audits the shipped song catalogue for scores that don't belong in a *piano* app —
// drum kits, other solo instruments — and for the cost:0 entries that the piano
// fingering grader couldn't score (which are largely the same non-piano scores). It
// only REPORTS: it prints a breakdown and writes the flagged ids to
// dev/catalog-nonpiano.json, so removal is a separate, reviewable step.
//
// Run under tsx: `npx tsx dev/audit-catalog.mts`

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { copyrightReason } from "./copyrightSignals.mts";
import { nonPianoReason } from "./scoreInstrument.mts";

const APPLY = process.argv.includes("--apply");

const DIR = "public/songs";
type Song = { id: string; title: string; composer: string; grade: number; cost: number };
const manifest: Song[] = JSON.parse(readFileSync(`${DIR}/manifest.json`, "utf8"));

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMusicXml(id: string): string {
    const entries = unzipSync(new Uint8Array(readFileSync(`${DIR}/${id}.mxl`)));
    const container = strFromU8(entries["META-INF/container.xml"] ?? new Uint8Array());
    const root =
        container.match(/full-path="([^"]+)"/)?.[1] ??
        Object.keys(entries).find((name) => name.endsWith(".xml") && !name.startsWith("META-INF"));
    if (!root || !entries[root]) {
        throw new Error("no rootfile");
    }
    return strFromU8(entries[root]);
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
        rmSync(`${DIR}/${f.id}.mxl`, { force: true });
    }
    writeFileSync(`${DIR}/manifest.json`, JSON.stringify(kept));
    console.log(`APPLIED: removed ${flagged.length} scores; manifest now ${kept.length}.`);
}

