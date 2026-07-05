// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Cleans the song catalogue: collapses it to one score per title, then re-balances the
// grade boundaries over what remains.
//
// PDMX titles are frequently the opus / collection name ("Préludes Op.28", "Album für
// die Jugend Op.68"), so many distinct movements — and some genuine re-transcriptions
// of the same work — share a title and read as duplicate rows in the library. This
// keeps the highest-quality representative of each title (by PDMX rating, then
// favourites, then views, then a fuller piece) and removes the rest.
//
// Removing songs shifts the cost distribution, so it then re-derives the eight even
// octile cost boundaries over the survivors and re-grades every song — keeping grades
// 1–8 evenly populated. It rewrites public/songs/manifest.json + seed.json and deletes
// the orphaned .mxl. **Bake the printed boundaries into GRADE_THRESHOLDS.piece
// (core/scoreDifficulty.ts), then run `npm run exercises`** so the studies (graded
// on the same piece scale) re-grade to match. Run locally: `npm run songs:dedup`.

import { createReadStream } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { gradeForCost, octileBoundaries } from "./grading.mts";

const OUT = "public/songs";
const ROOT = process.env.PDMX_DIR ?? "pdmx";
const MAX_GRADE = 8;

// The manifest fields dedup reads or re-grades. License and source are carried
// through verbatim — the type names them so a future rewrite of the survivor set
// can't silently drop a piece's provenance.
type Song = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    bars: number;
    license: string;
    source?: string;
};
type Quality = { rating: number; favorites: number; views: number };

const normalizeTitle = (title: string): string =>
    (title || "").toLowerCase().trim().replace(/\s+/g, " ");

async function main() {
    const manifest: Song[] = JSON.parse(await readFile(`${OUT}/manifest.json`, "utf8"));
    const ids = new Set(manifest.map((song) => song.id));

    // PDMX's crowd-quality signals for the catalogue's songs, joined by the .mxl id.
    const quality = new Map<string, Quality>();
    await new Promise<void>((resolve, reject) => {
        createReadStream(`${ROOT}/PDMX.csv`)
            .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }))
            .on("data", (row: Record<string, string>) => {
                const id = (row.mxl?.split("/").pop() ?? "").replace(/\.mxl$/, "");
                if (ids.has(id)) {
                    quality.set(id, {
                        rating: Number(row.rating) || 0,
                        favorites: Number(row.n_favorites) || 0,
                        views: Number(row.n_views) || 0,
                    });
                }
            })
            .on("end", () => resolve())
            .on("error", reject);
    });

    const q = (song: Song): Quality => quality.get(song.id) ?? { rating: 0, favorites: 0, views: 0 };
    // Positive when `a` is the better representative to keep.
    const better = (a: Song, b: Song): number => {
        const qa = q(a);
        const qb = q(b);
        return (
            qa.rating - qb.rating ||
            qa.favorites - qb.favorites ||
            qa.views - qb.views ||
            a.bars - b.bars
        );
    };

    const best = new Map<string, Song>();
    for (const song of manifest) {
        const key = normalizeTitle(song.title);
        const current = best.get(key);
        if (!current || better(song, current) > 0) {
            best.set(key, song);
        }
    }
    const keptIds = new Set([...best.values()].map((song) => song.id));
    // Easiest-first by cost, so the manifest reads gentle → hard and re-grading by the
    // octile boundaries lands grades in non-decreasing order (the manifest's contract).
    const deduped = manifest.filter((song) => keptIds.has(song.id)).sort((a, b) => a.cost - b.cost);

    // Re-balance: re-derive the eight even octile cost boundaries over the cleaned set,
    // and re-grade every song so grades 1–8 stay evenly populated after the removals.
    const boundaries = octileBoundaries(
        deduped.map((song) => song.cost),
        MAX_GRADE,
    );
    const histogram = Array.from({ length: MAX_GRADE + 1 }, () => 0);
    for (const song of deduped) {
        song.grade = gradeForCost(song.cost, boundaries);
        histogram[song.grade] = (histogram[song.grade] ?? 0) + 1;
    }

    await writeFile(`${OUT}/manifest.json`, JSON.stringify(deduped));
    let removed = 0;
    for (const song of manifest) {
        if (!keptIds.has(song.id)) {
            await rm(`${OUT}/${song.id}.mxl`, { force: true });
            removed++;
        }
    }

    // Reseed: three of each grade, so a fresh install still spans grades 1–8.
    const seed: string[] = [];
    for (let g = 1; g <= MAX_GRADE; g++) {
        seed.push(
            ...deduped
                .filter((song) => song.grade === g)
                .slice(0, 3)
                .map((song) => song.id),
        );
    }
    await writeFile(`${OUT}/seed.json`, JSON.stringify(seed));

    console.log(
        `Deduped by title: kept ${deduped.length} of ${manifest.length} songs (removed ${removed}).`,
    );
    console.log(`Re-balanced. Octile cost boundaries: [${boundaries.join(", ")}]`);
    console.log("Grade histogram:");
    for (let g = 1; g <= MAX_GRADE; g++) {
        console.log(`  grade ${g}: ${histogram[g]}`);
    }
    console.log("→ Bake the boundaries above into GRADE_THRESHOLDS.piece, then `npm run exercises`.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
