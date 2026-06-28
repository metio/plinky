// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Curates a public-domain solo-piano subset of the local PDMX corpus into the song
// catalogue. Reads pdmx/PDMX.csv + pdmx/mxl (a local, gitignored build input — never
// shipped), grades every candidate by raw fingering-cost, splits them into eight
// equal difficulty bins (so grades 1–8 are evenly populated), and writes
// public/songs/<id>.mxl plus a metadata manifest and a seed list. It also prints the
// bin boundaries — bake those into GRADE_THRESHOLDS.piece (app/lib/scoreDifficulty.ts)
// so the in-app grade chip matches the manifest. Run locally: `npm run songs:import`.
//
// Needs a DOM for the cost engine, so it runs under tsx with linkedom's DOMParser
// installed as the global the engine expects.

import { createReadStream, readFileSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { strFromU8, unzipSync } from "fflate";
import { DOMParser } from "linkedom";
import { copyrightReason } from "./copyrightSignals.mts";
import { gradeForCost, octileBoundaries } from "./grading.mts";
import { isPublicDomain } from "./publicDomain.mts";
import { nonSoloPianoReason } from "./scoreInstrument.mts";
// @ts-expect-error - the cost engine calls the global DOMParser, as in the browser
globalThis.DOMParser = DOMParser;
const { rawDifficulty, MAX_GRADE } = await import("../app/lib/scoreDifficulty.ts");

const ROOT = process.env.PDMX_DIR ?? "pdmx";
const OUT = "public/songs";

type Candidate = {
    id: string;
    mxl: string;
    title: string;
    composer: string;
    bars: number;
    // PDMX crowd-quality, kept to pick the best representative when collapsing the
    // many same-title scores (opus/collection titles) down to one — see dedupeByTitle.
    rating: number;
    favorites: number;
    views: number;
};
type Scored = Candidate & { cost: number; tempo: number; beatsPerBar: number; src: string };

const clean = (value: string | undefined): string => {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text === "NA" || text === "N/A" ? "" : text;
};

// Solo grand piano (MIDI program 0), deduplicated, rated, license-clean, not a draft,
// and a playable length — the bar that turns 254k files into a curated library.
function passes(row: Record<string, string>): boolean {
    const bars = Number(row["song_length.bars"]);
    const notes = Number(row.n_notes);
    // Note: the strict single-track grand-piano gate (row.tracks === "0") is dropped —
    // nonSoloPianoReason now reads each .mxl and keeps only true solo/duet piano, which
    // admits far more clean candidates than the conservative track filter did.
    const composer = (row.composer_name || row.artist_name || "").trim();
    const title = (row.song_name || row.title || "").trim();
    return (
        (row.license === "publicdomain" || row.license === "cc-zero") &&
        // PDMX's CC0 tag is unreliable — only admit compositions we can show are public
        // domain. Sheet music of a copyrighted song infringes the composition.
        isPublicDomain(composer, title) &&
        row["subset:rated_deduplicated"] === "True" &&
        row["subset:no_license_conflict"] === "True" &&
        row.is_draft === "False" &&
        !!row.mxl &&
        row.mxl !== "N/A" &&
        Number.isFinite(bars) &&
        bars >= 8 &&
        bars <= 200 &&
        Number.isFinite(notes) &&
        notes >= 24 &&
        notes <= 4000
    );
}

function toCandidate(row: Record<string, string>): Candidate {
    const mxl = row.mxl.replace(/^\.\//, "");
    return {
        id: (mxl.split("/").pop() ?? mxl).replace(/\.mxl$/, ""),
        mxl,
        title: clean(row.song_name) || clean(row.title) || "Untitled",
        composer: clean(row.composer_name) || clean(row.artist_name),
        bars: Number(row["song_length.bars"]) || 0,
        rating: Number(row.rating) || 0,
        favorites: Number(row.n_favorites) || 0,
        views: Number(row.n_views) || 0,
    };
}

// PDMX titles are frequently the opus / collection name, so many distinct movements
// (and some true re-transcriptions) share a title and read as duplicate rows in the
// library. Keep one per title — the highest-quality by PDMX rating, then favourites,
// then views, then a fuller piece. (The standalone `npm run songs:dedup` applies the
// same collapse to an already-imported catalogue without re-grading.)
const normalizeTitle = (title: string): string =>
    (title || "").toLowerCase().trim().replace(/\s+/g, " ");

function dedupeByTitle<T extends Candidate>(songs: T[]): T[] {
    const better = (a: T, b: T): number =>
        a.rating - b.rating || a.favorites - b.favorites || a.views - b.views || a.bars - b.bars;
    const best = new Map<string, T>();
    for (const song of songs) {
        const key = normalizeTitle(song.title);
        const current = best.get(key);
        if (!current || better(song, current) > 0) {
            best.set(key, song);
        }
    }
    return [...best.values()];
}

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMusicXml(path: string): string {
    const entries = unzipSync(new Uint8Array(readFileSync(path)));
    const container = strFromU8(entries["META-INF/container.xml"] ?? new Uint8Array());
    const root =
        container.match(/full-path="([^"]+)"/)?.[1] ??
        Object.keys(entries).find((name) => name.endsWith(".xml") && !name.startsWith("META-INF"));
    if (!root || !entries[root]) {
        throw new Error("no rootfile");
    }
    return strFromU8(entries[root]);
}

function tempoOf(xml: string): number {
    const tempo = Number(xml.match(/<sound[^>]*tempo="([\d.]+)"/)?.[1]);
    return Number.isFinite(tempo) && tempo >= 40 && tempo <= 208 ? Math.round(tempo) : 90;
}
function beatsOf(xml: string): number {
    const beats = Number(xml.match(/<beats>(\d+)<\/beats>/)?.[1]);
    return Number.isFinite(beats) && beats >= 1 && beats <= 16 ? beats : 4;
}

async function main() {
    console.log(`Reading ${ROOT}/PDMX.csv …`);
    const candidates: Candidate[] = [];
    await new Promise<void>((resolve, reject) => {
        createReadStream(`${ROOT}/PDMX.csv`)
            .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }))
            .on("data", (row: Record<string, string>) => {
                if (passes(row)) {
                    candidates.push(toCandidate(row));
                }
            })
            .on("end", () => resolve())
            .on("error", reject);
    });
    console.log(`${candidates.length} candidates pass the filter.`);

    // Grade every candidate by raw fingering-cost, skipping the unreadable or
    // unfingerable.
    const scored: Scored[] = [];
    for (const candidate of candidates) {
        // PDMX's CC0 tag can't be trusted — many "covers" are copyrighted. Reject the
        // ones whose composer names a known copyrighted act before doing any work.
        if (copyrightReason(candidate.composer)) {
            continue;
        }
        const src = `${ROOT}/${candidate.mxl}`;
        let xml: string;
        let cost: number;
        try {
            xml = readMusicXml(src);
            // Keep only true solo/duet piano — drum kits, other instruments, ensembles.
            if (nonSoloPianoReason(xml)) {
                continue;
            }
            cost = rawDifficulty(xml);
        } catch {
            continue;
        }
        scored.push({ ...candidate, cost, tempo: tempoOf(xml), beatsPerBar: beatsOf(xml), src });
        if (scored.length % 500 === 0) {
            console.log(`  graded ${scored.length} …`);
        }
    }

    // Collapse same-title scores to one before grading, so duplicate-looking rows never
    // reach the library and the octiles are balanced over distinct titles.
    const unique = dedupeByTitle(scored);
    console.log(`${unique.length} unique titles after collapsing ${scored.length} scored.`);

    // Even grades by construction: split the costs into MAX_GRADE equal octile bins.
    // The bin boundaries are the cost thresholds to bake into the engine.
    unique.sort((a, b) => a.cost - b.cost);
    const boundaries = octileBoundaries(
        unique.map((song) => song.cost),
        MAX_GRADE,
    );
    // Grade by the same threshold walk gradeOf uses, so the manifest grade matches
    // the in-app chip exactly once the boundaries are baked into GRADE_THRESHOLDS.
    const songs = unique.map((song) => ({ ...song, grade: gradeForCost(song.cost, boundaries) }));

    const histogram = Array.from({ length: MAX_GRADE + 1 }, () => 0);
    for (const song of songs) {
        histogram[song.grade] = (histogram[song.grade] ?? 0) + 1;
    }
    console.log(`\nGraded ${songs.length} songs. Octile cost boundaries: [${boundaries.join(", ")}]`);
    console.log("Grade histogram:");
    for (let g = 1; g <= MAX_GRADE; g++) {
        console.log(`  grade ${g}: ${histogram[g]}`);
    }

    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });
    // Store the compressed .mxl as-is (≈30× smaller than the decompressed XML); the
    // app decompresses it on open.
    for (const song of songs) {
        await copyFile(song.src, `${OUT}/${song.id}.mxl`);
    }

    const manifest = songs.map((song) => ({
        id: song.id,
        title: song.title,
        composer: song.composer,
        grade: song.grade,
        // The raw fingering-cost, so a grade's songs can be ordered easiest-first and
        // a syllabus can draw the gentlest of a grade rather than a random pick.
        cost: Number(song.cost.toFixed(3)),
        license: "CC0-1.0",
        tempo: song.tempo,
        beatsPerBar: song.beatsPerBar,
        bars: song.bars,
    }));
    await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest));

    // Seed: three of each grade, so a fresh install spans grades 1–8.
    const seed: string[] = [];
    for (let g = 1; g <= MAX_GRADE; g++) {
        seed.push(
            ...songs
                .filter((song) => song.grade === g)
                .slice(0, 3)
                .map((song) => song.id),
        );
    }
    await writeFile(`${OUT}/seed.json`, JSON.stringify(seed));

    console.log(
        `\nWrote ${songs.length} scores + manifest.json + seed.json (${seed.length}) to ${OUT}/.`,
    );
    console.log("→ Bake the boundaries above into GRADE_THRESHOLDS.piece in scoreDifficulty.ts.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
