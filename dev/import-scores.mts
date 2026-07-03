// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Imports curated open score corpora into the catalogue alongside the PDMX base.
// Unlike PDMX (a 30 GB local dataset of user uploads whose CC0 tags can't be trusted),
// these are small, curated, provably-licensed repos — so their licence is taken from
// the source config, not re-derived per composer. Each corpus already ships MusicXML
// (.mxl), so no format conversion is needed here.
//
// Composable and idempotent per source: a run replaces ONLY its own source's manifest
// entries and .mxl files, never another source's, so `scores:import openscore-lieder`
// can run repeatedly and alongside `songs:import` (PDMX). It writes provisional grades;
// run `npm run songs:bake` afterwards to finalise the octile boundaries + seed.
//
// Usage: `npm run scores:import [source-id]` (defaults to openscore-lieder). The corpus
// is cloned into sources/<id> (gitignored) on first run.
//
// Needs a DOM for the cost engine, so it installs linkedom's DOMParser as the global.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { DOMParser } from "linkedom";
import { gradeForCost, octileBoundaries } from "./grading.mts";
import { nonPianoVocalReason } from "./scoreInstrument.mts";
// @ts-expect-error - the cost engine calls the global DOMParser, as in the browser
globalThis.DOMParser = DOMParser;
const { rawDifficulty, MAX_GRADE } = await import("../app/lib/scoreDifficulty.ts");

const OUT = "public/songs";
const SOURCES_DIR = "sources";

type SourceConfig = {
    repo: string; // cloned to sources/<id> when the checkout is missing
    license: string; // the SPDX id every score from this source carries
    gate: (xml: string) => string | null; // instrument filter for this repertoire
};

// The corpora we trust for licensing (curated public-domain projects). OpenScore Lieder
// is 19th-century art song — a vocal line over a piano part — so it uses the piano-or-
// vocal gate rather than the strict solo-piano one.
const CONFIGS: Record<string, SourceConfig> = {
    "openscore-lieder": {
        repo: "https://github.com/OpenScore/Lieder.git",
        license: "CC0-1.0",
        gate: nonPianoVocalReason,
    },
};

type SongMeta = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    cost: number;
    license: string;
    source: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
};

const clean = (value: string | undefined): string => {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text === "NA" || text === "N/A" ? "" : text;
};

const norm = (value: string): string => (value || "").toLowerCase().trim().replace(/\s+/g, " ");
// Dedup key. A song collection shares one work-title across many movements, and
// different composers reuse the same song title ("Ständchen", "Ave Maria"), so the
// identity is the composer plus the specific (movement) title, never the title alone.
const songKey = (composer: string, title: string): string => `${norm(composer)}|${norm(title)}`;

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMxl(path: string): string {
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

const tagText = (xml: string, tag: string): string =>
    xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))?.[1] ?? "";

// Prefer the movement-title (the individual song) over the work-title (which, for a
// cycle or published collection, names the whole set — shared across every song in it).
function titleOf(xml: string): string {
    return clean(tagText(xml, "movement-title")) || clean(tagText(xml, "work-title")) || "Untitled";
}

function composerOf(xml: string): string {
    const typed = xml.match(/<creator\b[^>]*\btype="composer"[^>]*>([^<]*)<\/creator>/i)?.[1];
    return clean(typed) || clean(tagText(xml, "creator"));
}

function tempoOf(xml: string): number {
    const tempo = Number(xml.match(/<sound[^>]*tempo="([\d.]+)"/)?.[1]);
    return Number.isFinite(tempo) && tempo >= 40 && tempo <= 208 ? Math.round(tempo) : 90;
}
function beatsOf(xml: string): number {
    const beats = Number(xml.match(/<beats>(\d+)<\/beats>/)?.[1]);
    return Number.isFinite(beats) && beats >= 1 && beats <= 16 ? beats : 4;
}
// Bars = measures per part: the file repeats every bar once per part (voice + piano),
// so divide the raw measure count by the number of parts.
function barsOf(xml: string): number {
    const measures = (xml.match(/<measure\b/g) ?? []).length;
    const parts = Math.max(1, (xml.match(/<part\s+id=/g) ?? []).length);
    return Math.round(measures / parts) || 0;
}

async function main() {
    const key = process.argv[2] ?? "openscore-lieder";
    const cfg = CONFIGS[key];
    if (!cfg) {
        throw new Error(`unknown source "${key}"; known: ${Object.keys(CONFIGS).join(", ")}`);
    }

    const dir = `${SOURCES_DIR}/${key}`;
    if (!existsSync(dir)) {
        console.log(`Cloning ${cfg.repo} → ${dir} …`);
        await mkdir(SOURCES_DIR, { recursive: true });
        execSync(`git clone --depth 1 ${cfg.repo} ${dir}`, { stdio: "inherit" });
    }

    const manifestPath = `${OUT}/manifest.json`;
    const existing: SongMeta[] = existsSync(manifestPath)
        ? JSON.parse(await readFile(manifestPath, "utf8"))
        : [];
    // Drop this source's prior entries (and their files) so a re-run is a clean replace;
    // other sources are left untouched.
    const kept = existing.filter((song) => (song.source ?? "pdmx") !== key);
    for (const song of existing) {
        if ((song.source ?? "pdmx") === key) {
            await rm(`${OUT}/${song.id}.mxl`, { force: true });
        }
    }
    const takenKeys = new Set(kept.map((song) => songKey(song.composer, song.title)));
    const takenIds = new Set(kept.map((song) => song.id));

    const files = execSync(`find ${dir} -name '*.mxl'`, { encoding: "utf8", maxBuffer: 64 << 20 })
        .trim()
        .split("\n")
        .filter(Boolean);
    console.log(`${files.length} .mxl found in ${dir}.`);

    const added: (SongMeta & { src: string })[] = [];
    const dropped = { gate: 0, dup: 0, unreadable: 0 };
    for (const file of files) {
        let xml: string;
        try {
            xml = readMxl(file);
        } catch {
            dropped.unreadable++;
            continue;
        }
        if (cfg.gate(xml)) {
            dropped.gate++;
            continue;
        }
        const id = (file.split("/").pop() ?? file).replace(/\.mxl$/, "");
        const title = titleOf(xml);
        const composer = composerOf(xml);
        const dupeKey = songKey(composer, title);
        if (takenIds.has(id) || takenKeys.has(dupeKey)) {
            dropped.dup++;
            continue;
        }
        let cost: number;
        try {
            cost = rawDifficulty(xml);
        } catch {
            dropped.unreadable++;
            continue;
        }
        takenIds.add(id);
        takenKeys.add(dupeKey);
        added.push({
            id,
            title,
            composer,
            grade: 0,
            cost,
            license: cfg.license,
            source: key,
            tempo: tempoOf(xml),
            beatsPerBar: beatsOf(xml),
            bars: barsOf(xml),
            src: file,
        });
    }
    console.log(
        `Kept ${added.length}; dropped gate=${dropped.gate} dup=${dropped.dup} unreadable=${dropped.unreadable}.`,
    );

    for (const song of added) {
        await copyFile(song.src, `${OUT}/${song.id}.mxl`);
    }

    // Merge and provisionally grade over the whole catalogue's costs; songs:bake will
    // re-derive the identical boundaries and write them into the engine + seed.
    const merged: SongMeta[] = [...kept, ...added.map(({ src: _src, ...meta }) => meta)];
    const boundaries = octileBoundaries(
        merged.map((song) => song.cost),
        MAX_GRADE,
    );
    for (const song of merged) {
        song.grade = gradeForCost(song.cost, boundaries);
    }
    // The library renders songs in manifest order, so the catalogue is stored
    // easiest-first (grade follows cost, so this also keeps grade non-decreasing).
    merged.sort((a, b) => a.cost - b.cost);
    for (const song of merged) {
        song.cost = Number(song.cost.toFixed(3));
    }
    await writeFile(manifestPath, JSON.stringify(merged));

    const histogram = Array.from({ length: MAX_GRADE + 1 }, () => 0);
    for (const song of merged) {
        histogram[song.grade] = (histogram[song.grade] ?? 0) + 1;
    }
    console.log(`\nCatalogue now ${merged.length} songs (${kept.length} kept + ${added.length} ${key}).`);
    console.log(`Grades: ${histogram.slice(1).join(" / ")}`);
    console.log("→ Run `npm run songs:bake` to finalise grade boundaries + seed.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
