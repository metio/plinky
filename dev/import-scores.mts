// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Imports curated open score corpora into the catalogue alongside the PDMX base.
// Unlike PDMX (a 30 GB local dataset of user uploads whose CC0 tags can't be trusted),
// these are small, curated, provably-licensed repos — so their licence is taken from
// the source config, not re-derived per composer.
//
// Composable and idempotent per source: a run replaces ONLY its own source's manifest
// entries and .mxl files, never another source's, so `scores:import openscore-lieder`
// can run repeatedly and alongside `songs:import` (PDMX). It writes provisional grades;
// run `npm run songs:bake` afterwards to finalise the octile boundaries + seed.
//
// Usage: `npm run scores:import [source-id]` (defaults to openscore-lieder). Each repo is
// cloned into sources/<id>/<repo> (gitignored) on first run; preconverted sources ingest
// their .mxl straight from sources/<id>/_mxl.
//

import { rawDifficulty, MAX_GRADE } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { gradeForCost, octileBoundaries } from "./grading.mts";
import { nonPianoVocalReason, nonSoloPianoReason } from "./scoreInstrument.mts";
import { songId } from "../core/songId.ts";
import { licenseDir, licenseInfo } from "../core/attribution.ts";


const OUT = "public/songs";
const SOURCES_DIR = "sources";

type SourceConfig = {
    repos: string[]; // git URLs, each cloned to sources/<id>/<repo> when missing
    license: string; // the SPDX id every score from this source carries
    gate: (xml: string) => string | null; // instrument filter for this repertoire
    // Set when the .mxl were produced by an out-of-band step that needs a heavier
    // toolchain than this importer's container (Mutopia: LilyPond, in dev/mutopia.*).
    // The importer then ingests sources/<id>/_mxl/*.mxl directly — no clone, no convert.
    preconverted?: boolean;
    // Per-piece licence for sources whose licence varies by piece (Mutopia): the
    // harvester encodes a bucket token in each filename (mutopia-<bucket>-…) and this
    // maps it to the SPDX id. Falls back to `license` when a filename has no known bucket.
    bucketLicense?: Record<string, string>;
    // Which MusicXML title field holds the song title: a cycle/collection puts it in
    // the movement-title (work-title = the set), a keyboard sonata in the work-title
    // (movement-title = a tempo marking like "Allegro").
    titleField?: "movement" | "work";
    // KernScores names composers "Last, First"; flip to "First Last" for display.
    reorderComposer?: boolean;
};

// The corpora we trust for licensing (curated projects), all commercially usable.
// OpenScore Lieder is 19th-century art song (voice over piano) → the piano-or-vocal gate.
// Mutopia and CPDL ship public-domain / CC-BY / CC-BY-SA editions → the strict solo-piano
// gate, with a per-piece licence bucket encoded in each filename. A NonCommercial source
// can't be added here: the ingest loop refuses any piece whose licence isn't commercialUse
// (attribution.ts is the single source of truth), so a paid tier stays clear of NC content.
const CONFIGS: Record<string, SourceConfig> = {
    "openscore-lieder": {
        repos: ["https://github.com/OpenScore/Lieder.git"],
        license: "CC0-1.0",
        gate: nonPianoVocalReason,
        titleField: "movement",
    },
    // Public-domain solo-keyboard pieces from the Mutopia Project, converted from
    // LilyPond to two-staff piano MusicXML by dev/mutopia-harvest.py (run separately in
    // dev/mutopia.Containerfile, since LilyPond is too heavy for the lean importer image).
    mutopia: {
        repos: [],
        preconverted: true,
        license: "CC0-1.0",
        // Mutopia's licence is per-piece; dev/mutopia-harvest.py tags each filename.
        bucketLicense: {
            cc0: "CC0-1.0",
            by40: "CC-BY-4.0",
            by30: "CC-BY-3.0",
            by25: "CC-BY-2.5",
            bysa40: "CC-BY-SA-4.0",
            bysa30: "CC-BY-SA-3.0",
            bysa25: "CC-BY-SA-2.5",
        },
        gate: nonSoloPianoReason,
        titleField: "work",
        // Most Mutopia composers are "First Last", but a few are "Last, First";
        // reorderName only rewrites the comma form, so this fixes those and leaves
        // the rest untouched.
        reorderComposer: true,
    },
    // Public-domain choral editions from CPDL (ChoralWiki), reduced to a two-staff piano
    // grand staff by dev/cpdl-harvest.py (run separately — it scrapes + needs music21).
    // Only CC0/CC-BY/CC-BY-SA/PD editions are harvested; the licence varies per edition,
    // so the harvester encodes each one's SPDX bucket in the filename (like Mutopia).
    cpdl: {
        repos: [],
        preconverted: true,
        license: "CC0-1.0",
        bucketLicense: {
            cc0: "CC0-1.0",
            by40: "CC-BY-4.0",
            by30: "CC-BY-3.0",
            by25: "CC-BY-2.5",
            bysa40: "CC-BY-SA-4.0",
            bysa30: "CC-BY-SA-3.0",
            bysa25: "CC-BY-SA-2.5",
        },
        gate: nonSoloPianoReason,
        titleField: "work",
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

function titleOf(xml: string, field: "movement" | "work"): string {
    const work = clean(tagText(xml, "work-title"));
    const movement = clean(tagText(xml, "movement-title"));
    if (field === "work") {
        // Keyboard works: the work-title names the piece. A numbered movement is
        // appended so a multi-movement sonata's movements stay distinct entries; an
        // unnumbered piece's movement-title is just a tempo marking, so it's dropped.
        const numbered = clean(tagText(xml, "movement-number")) !== "";
        const label = numbered && movement ? `${work} — ${movement.replace(/\.$/, "")}` : work;
        return label || movement || "Untitled";
    }
    return movement || work || "Untitled";
}

// "Last, First" → "First Last"; leaves an already-plain name untouched.
const reorderName = (name: string): string => name.replace(/^([^,]+),\s*(.+)$/, "$2 $1");

function composerOf(xml: string, reorder: boolean): string {
    const typed = xml.match(/<creator\b[^>]*\btype="composer"[^>]*>([^<]*)<\/creator>/i)?.[1];
    const composer = clean(typed) || clean(tagText(xml, "creator"));
    return reorder ? reorderName(composer) : composer;
}

function tempoOf(xml: string): number {
    const tempo = Number(xml.match(/<sound[^>]*tempo="([\d.]+)"/)?.[1]);
    return Number.isFinite(tempo) && tempo >= 40 && tempo <= 208 ? Math.round(tempo) : 90;
}
function beatsOf(xml: string): number {
    const beats = Number(xml.match(/<beats>(\d+)<\/beats>/)?.[1]);
    return Number.isFinite(beats) && beats >= 1 && beats <= 16 ? beats : 4;
}
// Bars = measures per part: the measure count repeats once per part (a voice + a piano,
// or a piano's two staves), so divide the raw count by the number of parts.
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

    // Clone each repo (and, for kern, convert its .krn to .mxl) — gathering the .mxl to
    // ingest only from the dirs we manage, so a stray checkout can't leak in.
    await mkdir(`${SOURCES_DIR}/${key}`, { recursive: true });
    const files: string[] = [];
    if (cfg.preconverted) {
        const dir = `${SOURCES_DIR}/${key}/_mxl`;
        files.push(
            ...execSync(`find ${dir} -name '*.mxl'`, { encoding: "utf8", maxBuffer: 64 << 20 })
                .trim()
                .split("\n")
                .filter(Boolean),
        );
    }
    for (const repoUrl of cfg.repos) {
        const repoName = (repoUrl.split("/").pop() ?? repoUrl).replace(/\.git$/, "");
        const repoDir = `${SOURCES_DIR}/${key}/${repoName}`;
        if (!existsSync(repoDir)) {
            console.log(`Cloning ${repoUrl} → ${repoDir} …`);
            execSync(`git clone --depth 1 ${repoUrl} ${repoDir}`, { stdio: "inherit" });
        }
        files.push(
            ...execSync(`find ${repoDir} -name '*.mxl'`, { encoding: "utf8", maxBuffer: 64 << 20 })
                .trim()
                .split("\n")
                .filter(Boolean),
        );
    }
    console.log(`${files.length} .mxl to consider for "${key}".`);

    const manifestPath = `${OUT}/manifest.json`;
    const existing: SongMeta[] = existsSync(manifestPath)
        ? JSON.parse(await readFile(manifestPath, "utf8"))
        : [];
    // Drop this source's prior entries (and their files) so a re-run is a clean replace;
    // other sources are left untouched.
    const kept = existing.filter((song) => (song.source ?? "pdmx") !== key);
    for (const song of existing) {
        if ((song.source ?? "pdmx") === key) {
            await rm(`${OUT}/${licenseDir(song.license)}/${song.id}.mxl`, { force: true });
        }
    }
    const takenKeys = new Set(kept.map((song) => songKey(song.composer, song.title)));
    const takenIds = new Set(kept.map((song) => song.id));

    const added: (SongMeta & { src: string })[] = [];
    const dropped = { gate: 0, dup: 0, unreadable: 0, ineligible: 0 };
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
        const title = titleOf(xml, cfg.titleField ?? "movement");
        const composer = composerOf(xml, cfg.reorderComposer ?? false);
        // Per-piece licence when the source encodes a bucket in its filename (Mutopia,
        // CPDL); otherwise the source's single licence. Read from the SOURCE filename — the
        // catalogue id is a content fingerprint that carries no licence.
        const sourceName = file.split("/").pop() ?? file;
        const bucket = cfg.bucketLicense && sourceName.match(/^[a-z-]+-([a-z0-9]+)-/)?.[1];
        const license = (bucket && cfg.bucketLicense?.[bucket]) || cfg.license;
        // The catalogue admits only commercially usable, derivative-friendly pieces: a paid
        // tier can't ship NonCommercial scores, and the fingering/grading we add is a
        // derivative a NoDerivatives licence forbids. attribution.ts is the single source of
        // truth for both, so a NonCommercial or NoDerivatives source can never enter here.
        const info = licenseInfo(license);
        if (!info?.commercialUse || !info.allowsDerivatives) {
            dropped.ineligible++;
            continue;
        }
        // The id is a content fingerprint: stable across re-imports, identical for
        // identical music (which then collapses to one entry).
        const id = songId(xml);
        const dupeKey = songKey(composer, title);
        if (takenIds.has(id) || takenKeys.has(dupeKey)) {
            dropped.dup++;
            continue;
        }
        let cost: number;
        try {
            cost = rawDifficulty(linkedomXmlCodec, xml);
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
            license,
            source: key,
            tempo: tempoOf(xml),
            beatsPerBar: beatsOf(xml),
            bars: barsOf(xml),
            src: file,
        });
    }
    console.log(
        `Kept ${added.length}; dropped gate=${dropped.gate} dup=${dropped.dup} unreadable=${dropped.unreadable} ineligible=${dropped.ineligible}.`,
    );

    for (const song of added) {
        const dir = `${OUT}/${licenseDir(song.license)}`;
        await mkdir(dir, { recursive: true });
        await copyFile(song.src, `${dir}/${song.id}.mxl`);
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
