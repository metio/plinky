// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Emits the finger-exercise metadata the app browses. The exercises themselves are
// generated client-side from their config (core/exerciseGen.ts) — this just
// precomputes the grade of each of the 96 canonical tiles so the library can filter
// by grade without parsing MusicXML per row, ordered easiest-first within a grade.
//
// It also sources Hanon (The Virtuoso Pianist) from the local PDMX corpus when
// present (a gitignored build input): those are real transcriptions, not generated,
// so their MusicXML ships in a small gzipped pack. If PDMX or Hanon is absent, the
// pack is simply empty.
// Run: `npm run exercises`.

import { gradeOf, rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import { songId } from "../core/songId.ts";
import type { ExerciseConfig } from "../core/exerciseGen.ts";

const { EXERCISE_TILES, buildExerciseId, exerciseTitle, generateExercise } = await import(
    "../core/exerciseGen.ts"
);

const OUT = "public/exercises";
const ROOT = process.env.PDMX_DIR ?? "pdmx";

type Kind = "scale-arpeggio" | "study";
type Entry = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: Kind;
    config?: ExerciseConfig;
    composer?: string;
};
const entries: Entry[] = [];
const studyFiles: { id: string; src: string }[] = [];

for (const tile of EXERCISE_TILES) {
    const xml = generateExercise(tile);
    // The id is the content fingerprint (the one scheme); the config is stored so the app
    // can rebuild the exercise from the id.
    entries.push({
        id: songId(xml),
        title: exerciseTitle(tile),
        grade: gradeOf(linkedomXmlCodec, buildExerciseId(tile), xml),
        cost: rawDifficulty(linkedomXmlCodec, xml),
        kind: "scale-arpeggio",
        config: tile,
    });
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

// The classic public-domain study composers (Hanon, Czerny, Burgmüller, …).
const STUDY_RE = /czerny|burgm|lemoine|duvernoy|cramer|beyer|schmitt|gurlit|k[öo]hler|heller|bertini|streabbog|hanon|virtuoso pianist/i;

// Strip the date noise the PDMX composer/title fields carry — parenthetical lifespans,
// bare years — so a name reads as a name.
const cleanText = (value: string): string =>
    value
        .replace(/\(.*?\)/g, "")
        .replace(/\b1[5-9]\d\d\b/g, "")
        .replace(/[\s,\-–]+$/, "")
        .replace(/\s+/g, " ")
        .trim();

const normalizeTitle = (title: string): string =>
    (title || "").toLowerCase().trim().replace(/\s+/g, " ");

function sourceStudies(): void {
    if (!existsSync(`${ROOT}/PDMX.csv`)) {
        console.log("No PDMX corpus found — skipping studies.");
        return;
    }
    const lines = readFileSync(`${ROOT}/PDMX.csv`, "utf8").split("\n");
    const header = lines[0]!;
    const matched = lines.filter((line, i) => i > 0 && STUDY_RE.test(line));
    const rows = parse([header, ...matched].join("\n"), {
        columns: true,
        relax_quotes: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];
    const seen = new Set<string>();
    type Sourced = { entry: Entry; cid: string; src: string; quality: number };
    const sourced: Sourced[] = [];
    for (const row of rows) {
        const mxl = (row.mxl ?? "").replace(/^\.\//, "");
        const bars = Number(row["song_length.bars"]);
        const notes = Number(row.n_notes);
        // Individual études only — most method-book entries are the whole book
        // (thousands of bars), too big to ship or practise.
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
        const name = cleanText(row.song_name ?? "");
        const composer = cleanText(row.composer_name || row.artist_name || "");
        // The line-level STUDY_RE prefilter also matches noise elsewhere in the row —
        // e.g. a folk-dance subtitle spelling "Bayerisch" as "Beyerisch" — so require
        // the study composer in the fields that actually name the piece.
        if (!STUDY_RE.test(`${name} ${composer}`)) {
            continue;
        }
        // Drop byte-for-byte re-uploads of the same étude before the costlier read.
        const key = `${name}|${composer}|${bars}|${notes}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        try {
            const xml = readMusicXml(`${ROOT}/${mxl}`);
            const id = songId(xml);
            sourced.push({
                entry: {
                    id,
                    title: name && name !== "NA" ? name : "Study",
                    grade: gradeOf(linkedomXmlCodec, id, xml),
                    cost: rawDifficulty(linkedomXmlCodec, xml),
                    kind: "study",
                    composer: composer && composer !== "NA" ? composer : "",
                },
                cid: id,
                src: `${ROOT}/${mxl}`,
                // PDMX crowd-quality, to pick the representative when collapsing by title.
                quality: (Number(row.rating) || 0) * 1e9 + (Number(row.n_favorites) || 0) * 1e4 + (Number(row.n_views) || 0),
            });
        } catch {
            // Skip an unreadable transcription.
        }
    }
    // Collapse to one étude per title: PDMX titles are usually the method-book name
    // ("Études Enfantines Op.37"), so distinct exercises share a title and read as
    // duplicate rows. Keep the highest-quality representative of each.
    const best = new Map<string, Sourced>();
    for (const study of sourced) {
        const key = normalizeTitle(study.entry.title);
        const current = best.get(key);
        if (!current || study.quality > current.quality) {
            best.set(key, study);
        }
    }
    for (const study of best.values()) {
        entries.push(study.entry);
        studyFiles.push({ id: study.cid, src: study.src });
    }
    console.log(`Sourced ${best.size} studies from PDMX (collapsed from ${sourced.length} by title).`);
}

sourceStudies();

// Easiest-first within each grade, so a learner climbs gradually.
entries.sort((a, b) => a.grade - b.grade || a.cost - b.cost);
const manifest = entries.map(({ id, title, grade, cost, kind, composer, config }) => ({
    id,
    title,
    grade,
    // The raw fingering-cost the grade was binned from; lets a grade order its items
    // easiest-first and feeds the skill rating uniformly across songs and exercises.
    cost: Number(cost.toFixed(3)),
    kind,
    // A generated scale/arpeggio stores its config so the app rebuilds it from the id.
    ...(config ? { config } : {}),
    ...(composer ? { composer } : {}),
    // Curated studies are public-domain transcriptions from PDMX; the generated
    // scales/arpeggios are our own and carry no external licence.
    ...(kind === "study" ? { license: "CC0-1.0" } : {}),
    tempo: 90,
    beatsPerBar: 4,
}));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/studies`, { recursive: true });
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest));
// Studies ship as individual compressed .mxl, fetched on open like songs — named by the
// same content-fingerprint id.
for (const { id, src } of studyFiles) {
    copyFileSync(src, `${OUT}/studies/${id}.mxl`);
}

const histogram = Array.from({ length: 9 }, () => 0);
for (const entry of entries) {
    histogram[entry.grade] = (histogram[entry.grade] ?? 0) + 1;
}
console.log(`Wrote ${entries.length} exercises (${EXERCISE_TILES.length} tiles + ${studyFiles.length} studies) to ${OUT}/.`);
console.log("Grade histogram:");
for (let g = 1; g <= 8; g++) {
    console.log(`  grade ${g}: ${histogram[g]}`);
}
