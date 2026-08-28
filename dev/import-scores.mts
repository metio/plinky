// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { parse } from "csv-parse";
import { copyrightReason } from "./copyrightSignals.mts";
import { isPublicDomain } from "./publicDomain.mts";
import { legibleTitle, usableTitle } from "./legibleTitle.mts";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { gradeForCost, octileBoundaries } from "./grading.mts";
import {
    nonPianoVocalReason,
    nonSoloPianoReason,
    type ScoreKind,
    scoreKind,
} from "./scoreInstrument.mts";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { repairMxl } from "./repairPitch.mts";
import { songId } from "../core/songId.ts";
import { licenseDir, licenseInfo } from "../core/attribution.ts";

const OUT = "public/songs";
const PDMX_ROOT = process.env.PDMX_DIR ?? "pdmx";

// PDMX is not a curated repo but a 30 GB dump of user uploads, so it arrives with its own
// index and its own reasons to say no. Everything here is about which of 254,077 rows are
// even worth opening; once a file is opened it goes through the same gate, fingerprint and
// grading as every other source.
async function pdmxCandidates(): Promise<Candidate[]> {
    const rows: Candidate[] = [];
    const num = (value: string | undefined) => Number(value);
    await new Promise<void>((resolve, reject) => {
        createReadStream(`${PDMX_ROOT}/PDMX.csv`)
            .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }))
            .on("data", (row: Record<string, string>) => {
                const composer = (row.composer_name || row.artist_name || "").trim();
                const title = (row.song_name || row.title || "").trim();
                const bars = num(row["song_length.bars"]);
                const notes = num(row.n_notes);
                if (
                    (row.license === "publicdomain" || row.license === "cc-zero") &&
                    // PDMX's CC0 tag is unreliable — sheet music of a copyrighted song
                    // infringes the composition however the uploader tagged it.
                    isPublicDomain(composer, title) &&
                    !copyrightReason(composer) &&
                    // A piece nobody can name is a piece nobody can find.
                    legibleTitle(title) !== "" &&
                    row["subset:rated_deduplicated"] === "True" &&
                    row["subset:no_license_conflict"] === "True" &&
                    row.is_draft === "False" &&
                    row.mxl &&
                    row.mxl !== "N/A" &&
                    // Four bars, not eight: the pieces a beginner meets first are short by
                    // definition, and Czerny's opening set is named for being eight bars
                    // long — a floor at eight decided by rounding whether it qualified.
                    Number.isFinite(bars) &&
                    bars >= 4 &&
                    bars <= 200 &&
                    Number.isFinite(notes) &&
                    notes >= 24 &&
                    notes <= 4000
                ) {
                    rows.push({
                        path: `${PDMX_ROOT}/${row.mxl.replace(/^\.\//, "")}`,
                        title,
                        composer,
                    });
                }
            })
            .on("end", () => resolve())
            .on("error", reject);
    });
    return rows;
}
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
    // What this source's scores ARE, recorded on every row it writes. A curated corpus
    // knows: OpenScore Lieder is art song, CPDL is choral reduced to a grand staff,
    // Mutopia is solo keyboard. Only a mixed corpus has to be asked file by file, which
    // is what the function form is for.
    //
    // This is the field that lets the grade ladder draw from solo piano alone while the
    // library keeps everything — the alternative being to throw two thousand playable,
    // correctly-licensed scores away for being filed under the wrong heading.
    kind: ScoreKind | ((xml: string) => ScoreKind);
    // Where this source's files come from, when they are not simply the .mxl under
    // sources/<id>. PDMX is a 30 GB corpus indexed by a CSV, so it says for itself which
    // of a quarter of a million files are even candidates.
    candidates?: () => Promise<Candidate[]>;
    // Who to credit for a given file, when the harvester recorded it and the MusicXML did
    // not. Returns undefined for a piece it has no name for, which is not an error: an
    // edition may simply not say.
    creditFor?: (file: string) => string | undefined;
};

// A file this source offers, with whatever the source already knows about it. The title
// and composer are hints: the MusicXML is still the authority once it is read.
export type Candidate = { path: string; title?: string; composer?: string };

// The corpora we trust for licensing (curated projects), all commercially usable.
// OpenScore Lieder is 19th-century art song (voice over piano) → the piano-or-vocal gate.
// Mutopia and CPDL ship public-domain / CC-BY / CC-BY-SA editions → the strict solo-piano
// gate, with a per-piece licence bucket encoded in each filename. A NonCommercial source
// can't be added here: the ingest loop refuses any piece whose licence isn't commercialUse
// (attribution.ts is the single source of truth), so a paid tier stays clear of NC content.
// CPDL's harvester writes a plan of every edition it kept, including who engraved it. The
// reduced files are named from the composer and title, which is what joins them back.
let cpdlPlan: Map<string, string> | null = null;
function cpdlCredit(file: string): string | undefined {
    if (cpdlPlan === null) {
        cpdlPlan = new Map();
        const path = `${SOURCES_DIR}/cpdl/plan.json`;
        if (existsSync(path)) {
            const state = JSON.parse(readFileSync(path, "utf8"));
            for (const entry of state.plan ?? state) {
                if (entry.editor) {
                    cpdlPlan.set(cpdlSlug(entry.composer, entry.title), entry.editor);
                }
            }
        }
    }
    const name = (file.split("/").pop() ?? "").replace(/\.mxl$/, "");
    // cpdl-<bucket>-<slug>
    const slug = name.replace(/^cpdl-[a-z0-9]+-/, "");
    return cpdlPlan.get(slug);
}

// The same slug dev/cpdl-harvest.py builds its filenames from.
const cpdlSlug = (composer: string, title: string): string =>
    `${composer}-${title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const CONFIGS: Record<string, SourceConfig> = {
    "openscore-lieder": {
        // 19th-century art song: a singer over a piano part. Kept deliberately — Plinky
        // opens the piano and can sound the voice as accompaniment — and labelled, so the
        // grade ladder does not offer a Schubert accompaniment as a first piece.
        kind: "voice-and-piano",
        repos: ["https://github.com/OpenScore/Lieder.git"],
        license: "CC0-1.0",
        gate: nonPianoVocalReason,
        titleField: "movement",
    },
    // Public-domain solo-keyboard pieces from the Mutopia Project, converted from
    // LilyPond to two-staff piano MusicXML by dev/mutopia-harvest.py (run separately in
    // dev/mutopia.Containerfile, since LilyPond is too heavy for the lean importer image).
    mutopia: {
        // dev/mutopia-harvest.py harvests solo keyboard and nothing else.
        kind: "solo-piano",
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
        creditFor: cpdlCredit,
        // Choral editions reduced to a grand staff by dev/cpdl-harvest.py, which drops the
        // vocal part names on the way — so nothing in the file says it was ever choral and
        // only the harvester knows. This is why kind is a property of the source.
        kind: "choral-reduction",
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
    // The base corpus, and the only mixed one: a dump of user uploads rather than a
    // curated repertoire, so what each piece IS has to be read from the file rather than
    // known from the source.
    pdmx: {
        repos: [],
        candidates: pdmxCandidates,
        license: "CC0-1.0",
        gate: nonSoloPianoReason,
        kind: scoreKind,
    },
};

type SongMeta = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    cost: number;
    license: string;
    // What this piece IS (see ScoreKind): what lets the grade ladder ask for solo piano
    // while the library keeps the songs and the choral reductions.
    kind: ScoreKind;
    // The opening bars, encoded (see core/incipit).
    incipit?: string;
    // Who engraved this edition, where the source names them. CC-BY and CC-BY-SA require
    // crediting the creator, and "the CPDL editors" — the per-source constant that stood
    // in until now — credits nobody in particular.
    credit?: string;
    source: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
};

const clean = (value: string | undefined): string => {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text === "NA" || text === "N/A" ? "" : text;
};

const _norm = (value: string): string => (value || "").toLowerCase().trim().replace(/\s+/g, " ");
// Dedup key. A song collection shares one work-title across many movements, and
// different composers reuse the same song title ("Ständchen", "Ave Maria"), so the

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMxlFrom(bytes: Buffer): string {
    const entries = unzipSync(new Uint8Array(bytes));
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

// How many pieces the catalogue holds right now, for deciding whether a pass changed
// anything.
function countSongs(): number {
    return JSON.parse(readFileSync(`${OUT}/manifest.json`, "utf8")).length;
}

async function main() {
    const key = process.argv[2] ?? "openscore-lieder";
    const cfg = CONFIGS[key];
    if (!cfg) {
        throw new Error(`unknown source "${key}"; known: ${Object.keys(CONFIGS).join(", ")}`);
    }

    // Clone each repo, gathering the .mxl to ingest only from the dirs we manage, so a
    // stray checkout can't leak in.
    await mkdir(`${SOURCES_DIR}/${key}`, { recursive: true });
    const files: string[] = [];
    // What a source already knows about a file: PDMX's index names the piece even where
    // the MusicXML inside does not, and dropping that is what put 178 pieces called
    // "Untitled" in front of readers.
    const hints = new Map<string, Candidate>();
    if (cfg.candidates) {
        for (const candidate of await cfg.candidates()) {
            hints.set(candidate.path, candidate);
            files.push(candidate.path);
        }
    }
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
    // every other source is left standing. This is what makes the importers runnable in
    // sequence, and it is the whole reason none of them may empty the directory first.
    //
    // A row with no `source` belongs to nobody yet — it predates the field. Reading those
    // as this source's would delete the entire catalogue the first time any importer ran,
    // which is the bug this replaced, reintroduced through the default. They are kept, and
    // an unstamped row is replaced only when this run produces the same piece: the id is a
    // content fingerprint, so that is the same music, and the new row carries the source
    // the old one was missing. The catalogue converges as each source is re-imported.
    const owned = (song: SongMeta) => song.source === key;
    const kept = existing.filter((song) => !owned(song));
    for (const song of existing.filter(owned)) {
        await rm(`${OUT}/${licenseDir(song.license)}/${song.id}.mxl`, { force: true });
    }
    const unstamped = new Map(
        kept.filter((song) => !song.source).map((song) => [song.id, song] as const),
    );
    // An unstamped row does not reserve its id: this run may replace it with the same
    // music, properly attributed.
    const takenIds = new Set(kept.filter((song) => song.source).map((song) => song.id));

    const added: (SongMeta & { src: string; repaired?: Buffer })[] = [];
    let repairs = 0;
    const dropped = { gate: 0, dup: 0, unreadable: 0, ineligible: 0, unnamed: 0 };
    // Cheapest and most eliminating first, expensive work only on what survives.
    //
    // Of 1,709 candidates the gate alone rejects 954, so anything done before it is done
    // more than twice over for nothing. Repair unzips, rewrites and rezips a file, and
    // grading parses the whole score and fingers every position — neither has any business
    // running on a piece about to be dropped for being a wind quintet.
    for (const file of files) {
        let raw: Buffer;
        let xml: string;
        try {
            raw = readFileSync(file);
            xml = readMxlFrom(raw);
        } catch {
            dropped.unreadable++;
            continue;
        }
        if (cfg.gate(xml)) {
            dropped.gate++;
            continue;
        }
        // The file first, the source's index second. A notation program writes "Title"
        // and "Composer" into every new score, so a score that was never named carries
        // that text rather than nothing — and it is not a name.
        const hint = hints.get(file);
        const title = usableTitle(titleOf(xml, cfg.titleField ?? "movement"), hint?.title);
        if (title === "") {
            // A piece nobody can name is a piece nobody can find.
            dropped.unnamed++;
            continue;
        }
        const composer = usableTitle(composerOf(xml, cfg.reorderComposer ?? false), hint?.composer);
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
        // Collapsed by what the music IS, never by what it is called.
        //
        // Keying on composer-and-title looked equivalent and was not: a teaching
        // collection is exactly the case where many different pieces carry one title,
        // because the uploader names every file after the opus. Burgmüller's twenty-five
        // studies collapsed to a single row literally called "25 Études faciles et
        // progressives Op.100", and the same happened to every method book in the corpora
        // — the beginner repertoire, filtered out for looking repetitive.
        //
        // Two transcriptions of one piece share a fingerprint and still collapse. Near
        // duplicates that differ in engraving are a separate question, and
        // `npm run songs:dedup` is where it belongs.
        if (takenIds.has(id)) {
            dropped.dup++;
            continue;
        }
        // A keeper, so it is worth repairing. A harvested transcription occasionally
        // writes a bass note an octave low, so there is no key for it and a run waits for
        // that note forever. Done here rather than by a command afterwards, because that
        // command edits the files in public/songs and the next import copies fresh ones
        // over the top — the repair undone, with nothing recording it had happened.
        //
        // After the fingerprint on purpose: the id is the piece's identity, and moving a
        // wrong note back where it belongs does not make it a different piece. Fingerprint
        // first and the id is the same whether or not this ran.
        let repairedBytes: Buffer | null = null;
        try {
            const fixed = repairMxl(raw);
            if (fixed.moved > 0) {
                repairedBytes = fixed.buffer;
                repairs += fixed.moved;
                xml = readMxlFrom(fixed.buffer);
            }
        } catch {
            // A file that will not rezip is still a perfectly good score to grade as it
            // came; the repair is an improvement, not a requirement.
        }
        let cost: number;
        try {
            cost = rawDifficulty(linkedomXmlCodec, xml);
        } catch {
            dropped.unreadable++;
            continue;
        }
        let incipit: string | undefined;
        try {
            const opening = readIncipit(linkedomXmlCodec, xml);
            incipit = opening ? encodeIncipit(opening) : undefined;
        } catch {
            // A piece whose opening will not read is shown as a plain row, which is what
            // the absent field already means.
        }
        takenIds.add(id);
        added.push({
            id,
            title,
            composer,
            grade: 0,
            cost,
            license,
            source: key,
            kind: typeof cfg.kind === "function" ? cfg.kind(xml) : cfg.kind,
            credit: cfg.creditFor?.(file),
            // The opening bars, so a list can draw the mark that names a piece without
            // fetching its notation. Computed here from the score already in hand and
            // already repaired, rather than by a pass afterwards that reads every file in
            // the catalogue a second time to learn what this loop knew.
            ...(incipit === undefined ? {} : { incipit }),
            tempo: tempoOf(xml),
            beatsPerBar: beatsOf(xml),
            bars: barsOf(xml),
            src: file,
            ...(repairedBytes ? { repaired: repairedBytes } : {}),
        });
    }
    console.log(
        `Kept ${added.length}; dropped gate=${dropped.gate} dup=${dropped.dup} unreadable=${dropped.unreadable} ineligible=${dropped.ineligible} unnamed=${dropped.unnamed}; repaired ${repairs} note(s).`,
    );

    for (const song of added) {
        const dir = `${OUT}/${licenseDir(song.license)}`;
        await mkdir(dir, { recursive: true });
        // The repaired bytes when anything moved, the original otherwise — so a file the
        // importer did not change is stored byte for byte as it was harvested.
        if (song.repaired) {
            await writeFile(`${dir}/${song.id}.mxl`, song.repaired);
        } else {
            await copyFile(song.src, `${dir}/${song.id}.mxl`);
        }
    }

    // Merge and provisionally grade over the whole catalogue's costs; songs:bake will
    // re-derive the identical boundaries and write them into the engine + seed.
    const superseded = new Set(added.filter((song) => unstamped.has(song.id)).map((s) => s.id));
    if (superseded.size > 0) {
        console.log(`${superseded.size} unstamped row(s) adopted by "${key}" and now attributed.`);
    }
    const merged: SongMeta[] = [
        ...kept.filter((song) => !superseded.has(song.id)),
        ...added.map(({ src: _src, repaired: _repaired, ...meta }) => meta),
    ];
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
    console.log(
        `\nCatalogue now ${merged.length} songs (${kept.length} kept + ${added.length} ${key}).`,
    );
    console.log(`Grades: ${histogram.slice(1).join(" / ")}`);

    // Finish the job rather than telling somebody what to run next.
    //
    // These were three more commands and an order to remember, and every gate that
    // checked them ended by printing the order again. A catalogue is only consistent once
    // all of them have run, so anything less than all of them is a half-imported
    // catalogue that looks finished — which is what the gates kept catching.
    //
    // Prune first: it decides what stays, and there is no sense drawing an opening mark
    // for a piece about to be removed. Bake last: it derives the grade boundaries from
    // whatever survived, so it has to see the final set.
    // Bake first, then prune, then bake again. It reads like one bake too many and is not:
    // baking applies dev/catalog-curation.json, which corrects composers and titles, and
    // prune decides a duplicate by comparing exactly those. Pruning first left twelve
    // pairs that only became identical once the corrections landed — and the gate then
    // reported them, on a catalogue that had just been pruned.
    console.log("\n--- songs:bake (apply corrections before looking for duplicates) ---");
    execSync("npm run songs:bake", { stdio: "inherit" });

    // Prune runs to a fixed point, not once. It decides a duplicate by comparing a piece
    // against what is still in the catalogue, so removing one copy can reveal a pair that
    // was hidden behind it — a single pass left twelve behind.
    for (let pass = 1; pass <= 8; pass++) {
        console.log(`\n--- songs:prune + songs:bake (pass ${pass}) ---`);
        const before = countSongs();
        execSync("npm run songs:prune", { stdio: "inherit" });
        // Baked inside the loop, not after it: a correction can merge two spellings of one
        // composer, and two pieces that were not duplicates under different names are
        // duplicates under the same one. Pruning without re-applying the corrections
        // leaves that pair behind, which is what the gate kept reporting.
        execSync("npm run songs:bake", { stdio: "inherit" });
        if (countSongs() === before) {
            break;
        }
    }
    // songs:incipits is deliberately NOT in this chain any more: every row written above
    // carries its own mark, computed from the score while it was open. The command remains
    // for backfilling rows imported before that was true.
    console.log("\n--- songs:bake ---");
    execSync("npm run songs:bake", { stdio: "inherit" });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
