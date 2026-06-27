// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Emits the finger-exercise metadata the app browses. The exercises themselves are
// generated client-side from their config (app/lib/exerciseGen.ts) — this just
// precomputes the grade of each of the 96 canonical tiles so the library can filter
// by grade without parsing MusicXML per row, ordered easiest-first within a grade.
//
// It also sources Hanon (The Virtuoso Pianist) from the local PDMX corpus when
// present (a gitignored build input): those are real transcriptions, not generated,
// so their MusicXML ships in a small gzipped pack. If PDMX or Hanon is absent, the
// pack is simply empty. Needs a DOM for the grading engine (linkedom under tsx).
// Run: `npm run exercises`.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { gzipSync, strFromU8, strToU8, unzipSync } from "fflate";
import { DOMParser } from "linkedom";
// @ts-expect-error - the grading engine calls the global DOMParser, as in the browser
globalThis.DOMParser = DOMParser;
const { gradeOf, rawDifficulty } = await import("../app/lib/scoreDifficulty.ts");
const { EXERCISE_TILES, buildExerciseId, exerciseTitle, generateExercise } = await import(
    "../app/lib/exerciseGen.ts"
);

const OUT = "public/exercises";
const ROOT = process.env.PDMX_DIR ?? "pdmx";

type Entry = { id: string; title: string; grade: number; cost: number };
const entries: Entry[] = [];
const hanonPack: Record<string, string> = {};

for (const tile of EXERCISE_TILES) {
    const id = buildExerciseId(tile);
    const xml = generateExercise(tile);
    entries.push({ id, title: exerciseTitle(tile), grade: gradeOf(id, xml), cost: rawDifficulty(xml) });
}

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMusicXml(path: string): string {
    const zip = unzipSync(new Uint8Array(readFileSync(path)));
    const container = strFromU8(zip["META-INF/container.xml"] ?? new Uint8Array());
    const root =
        container.match(/full-path="([^"]+)"/)?.[1] ??
        Object.keys(zip).find((name) => name.endsWith(".xml") && !name.startsWith("META-INF"));
    if (!root || !zip[root]) {
        throw new Error("no rootfile");
    }
    return strFromU8(zip[root]);
}

function sourceHanon(): void {
    if (!existsSync(`${ROOT}/PDMX.csv`)) {
        console.log("No PDMX corpus found — skipping Hanon.");
        return;
    }
    const lines = readFileSync(`${ROOT}/PDMX.csv`, "utf8").split("\n");
    const header = lines[0]!;
    const matched = lines.filter((line, i) => i > 0 && /virtuoso pianist|hanon/i.test(line));
    const rows = parse([header, ...matched].join("\n"), {
        columns: true,
        relax_quotes: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];
    let found = 0;
    for (const row of rows) {
        const mxl = (row.mxl ?? "").replace(/^\.\//, "");
        const bars = Number(row["song_length.bars"]);
        const notes = Number(row.n_notes);
        // Keep only individual exercises — most "Virtuoso Pianist" entries are the
        // whole 60-exercise book (thousands of bars), too big to ship or practise.
        if (
            !(row.license === "publicdomain" || row.license === "cc-zero") ||
            row.tracks !== "0" ||
            !mxl ||
            mxl === "N/A" ||
            !existsSync(`${ROOT}/${mxl}`) ||
            !(bars >= 4 && bars <= 80) ||
            !(notes >= 24 && notes <= 1500)
        ) {
            continue;
        }
        try {
            const xml = readMusicXml(`${ROOT}/${mxl}`);
            const cid = (mxl.split("/").pop() ?? mxl).replace(/\.mxl$/, "");
            const id = `hanon-${cid}`;
            const name = (row.song_name ?? "").trim();
            const title = name && name !== "NA" ? name : "Hanon finger exercise";
            entries.push({ id, title, grade: gradeOf(id, xml), cost: rawDifficulty(xml) });
            hanonPack[id] = xml;
            found += 1;
        } catch {
            // Skip an unreadable transcription.
        }
    }
    console.log(`Sourced ${found} Hanon exercises from PDMX.`);
}

sourceHanon();

// Easiest-first within each grade, so a learner climbs gradually.
entries.sort((a, b) => a.grade - b.grade || a.cost - b.cost);
const manifest = entries.map(({ id, title, grade }) => ({ id, title, grade, tempo: 90, beatsPerBar: 4 }));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest));
writeFileSync(`${OUT}/hanon.json.gz`, gzipSync(strToU8(JSON.stringify(hanonPack))));

const histogram = Array.from({ length: 9 }, () => 0);
for (const entry of entries) {
    histogram[entry.grade] = (histogram[entry.grade] ?? 0) + 1;
}
console.log(`Wrote ${entries.length} exercises (${EXERCISE_TILES.length} tiles + ${Object.keys(hanonPack).length} Hanon) to ${OUT}/.`);
console.log("Grade histogram:");
for (let g = 1; g <= 8; g++) {
    console.log(`  grade ${g}: ${histogram[g]}`);
}
