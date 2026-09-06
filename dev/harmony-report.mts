// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How confidently the harmony reader reads the catalogue: a report, not a gate.
//
// core/harmony works out the chords of a piece from its notes, beat by beat, and says
// how well each chord fit. Before a surface shows those chords to a player, this says how
// often the reading is sure across the real catalogue — and names the pieces it is least
// sure of, which is where the model is wrong or the music is chromatic. Reads the files,
// not the engraver, so it runs here in about a minute.
//
// Usage: npm run harmony:report [-- --piece <id>]  prints one piece's spans in full.

import { readFileSync } from "node:fs";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { readTimeline } from "../core/musicxmlTimeline.ts";
import { type ChordSpan, readHarmony } from "../core/harmony.ts";
import { NOTE_TEXT, noteNameOf } from "../core/theory.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { readSongsSync, scorePath } from "./manifest.mts";

const SURE = 0.6;

const pieceAt = process.argv.indexOf("--piece");
const ONLY = pieceAt >= 0 ? process.argv[pieceAt + 1] : undefined;

function spansOf(id: string, license: string): ChordSpan[] | null {
    const path = scorePath(id, license);
    if (path === null) {
        return null;
    }
    const xml = decompressMxl(new Uint8Array(readFileSync(path)));
    if (!xml) {
        return null;
    }
    const doc = linkedomXmlCodec.parse(xml);
    if (doc === null) {
        return null;
    }
    return readHarmony(readTimeline(doc));
}

const symbol = (span: ChordSpan) =>
    `${NOTE_TEXT[noteNameOf(span.root, span.key.mode === "major" && span.key.tonic <= 6 ? "sharp" : "flat")]} ${span.quality}${span.inversion > 0 ? ` /${NOTE_TEXT[noteNameOf(span.bass)]}` : ""}`;

const songs = readSongsSync().filter((song) => song.scoreKind === "solo-piano");

if (ONLY !== undefined) {
    const song = songs.find((one) => one.id === ONLY);
    const spans = song ? spansOf(song.id, song.license) : null;
    if (!song || !spans) {
        console.error(`no solo-piano piece ${ONLY}`);
        process.exit(1);
    }
    console.log(`${song.title} — ${song.composer}`);
    for (const span of spans) {
        console.log(
            `  ${span.from.toFixed(3).padStart(8)} – ${span.to.toFixed(3).padEnd(8)} ${span.numeral.padEnd(6)} ${symbol(span).padEnd(28)} ${(100 * span.confidence).toFixed(0).padStart(3)}%`,
        );
    }
    process.exit(0);
}

type Row = { id: string; title: string; spans: number; sure: number; mean: number; mode: string };
const rows: Row[] = [];
let allSpans = 0;
let sureSpans = 0;
const buckets = new Array<number>(10).fill(0);
for (const song of songs) {
    const spans = spansOf(song.id, song.license);
    if (!spans || spans.length === 0) {
        continue;
    }
    let sure = 0;
    let sum = 0;
    for (const span of spans) {
        sum += span.confidence;
        if (span.confidence >= SURE) {
            sure += 1;
        }
        const bucket = Math.min(9, Math.floor(span.confidence * 10));
        buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    allSpans += spans.length;
    sureSpans += sure;
    rows.push({
        id: song.id,
        title: song.title,
        spans: spans.length,
        sure: sure / spans.length,
        mean: sum / spans.length,
        mode: spans[0]?.key.mode ?? "?",
    });
}
const pct = (value: number) => `${(100 * value).toFixed(1)}%`;
console.log(`${rows.length} solo-piano pieces read, ${allSpans} chord spans.`);
console.log(`Spans read with confidence ≥ ${SURE}: ${pct(sureSpans / allSpans)}`);
console.log(
    `Pieces where at least 80% of spans are sure: ${pct(rows.filter((row) => row.sure >= 0.8).length / rows.length)}`,
);
console.log(
    `Pieces read as minor: ${pct(rows.filter((row) => row.mode === "minor").length / rows.length)}`,
);
console.log("Confidence distribution (spans per tenth):");
for (const [index, count] of buckets.entries()) {
    console.log(
        `  ${(index / 10).toFixed(1)}–${((index + 1) / 10).toFixed(1)}  ${"#".repeat(Math.round((60 * count) / allSpans))} ${pct(count / allSpans)}`,
    );
}
console.log("\nLeast sure pieces:");
for (const row of [...rows].sort((a, b) => a.sure - b.sure).slice(0, 12)) {
    console.log(
        `  ${pct(row.sure).padStart(6)} sure, mean ${pct(row.mean).padStart(6)}  ${row.id} ${row.title.slice(0, 50)}`,
    );
}
console.log("\nMost sure pieces:");
for (const row of [...rows].sort((a, b) => b.sure - a.sure || b.spans - a.spans).slice(0, 6)) {
    console.log(
        `  ${pct(row.sure).padStart(6)} sure, mean ${pct(row.mean).padStart(6)}  ${row.id} ${row.title.slice(0, 50)}`,
    );
}
