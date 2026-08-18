// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Hand-made corrections to catalogue metadata, kept where an import cannot flatten them.
//
// The catalogue is harvested, and a harvested credit line is whatever the engraver typed:
// a title that names a piece the score is only the opening of, a composer's name
// misspelled. Fixing those in public/songs/manifest.json works until the next
// `songs:import`, which writes that file from the corpora again and takes the correction
// with it. So the corrections live here, keyed by song id, and are re-applied by
// `npm run songs:bake` — which is also the CI gate, so a manifest that has drifted from
// this file fails the build rather than shipping.
//
// The id is the right key precisely because it is a fingerprint of the notes: re-imports,
// re-slugging and re-licensing all leave it alone, so a correction stays attached to the
// piece it was made for.
//
// Only `title` and `composer` may be corrected. Not licence — that is a legal fact about
// the score, read from the corpus that supplied it, and a file whose job is fixing typos
// must not be able to quietly relicense a piece. Not grade or cost either: those are
// derived from the notes, and a hand-written override would be a number nobody could
// reproduce.
//
// Distinct from the alias table in core/person.ts, which maps a spelling to a person for
// display and applies to every piece bearing it, now and in future. This corrects the
// stored data of one named piece. A composer typo can be worth both: the alias so any
// piece that arrives with it lands on the right page, the curation so the shipped data is
// simply right.
//
// One trap when writing a composer here: a comma is read as "Surname, Forename" and
// reordered, so a credit naming several people joins them with "&" rather than commas.

import { readFile } from "node:fs/promises";

export const CURATION_FILE = "dev/catalog-curation.json";

// A correction to one piece. `why` is required: a bare id and a replacement string, a year
// later, is indistinguishable from vandalism, and nobody can tell whether it is still
// needed without it.
export type Curation = {
    id: string;
    title?: string;
    composer?: string;
    why: string;
};

const FIELDS = ["title", "composer"] as const;
const ALLOWED = new Set<string>(["id", "why", ...FIELDS]);

// Reads the file's shape without touching a disk, so the rules above are testable and a
// malformed entry is rejected with a reason rather than half-applied.
export function parseCuration(raw: unknown): { curations: Curation[]; problems: string[] } {
    const problems: string[] = [];
    if (!Array.isArray(raw)) {
        return { curations: [], problems: [`${CURATION_FILE} must hold an array`] };
    }
    const curations: Curation[] = [];
    const seen = new Set<string>();
    for (const [index, entry] of raw.entries()) {
        const at = `${CURATION_FILE}[${index}]`;
        if (!entry || typeof entry !== "object") {
            problems.push(`${at} is not an object`);
            continue;
        }
        const record = entry as Record<string, unknown>;
        const unknown = Object.keys(record).filter((key) => !ALLOWED.has(key));
        if (unknown.length > 0) {
            problems.push(`${at} sets ${unknown.join(", ")}, which curation may not change`);
            continue;
        }
        if (typeof record.id !== "string" || record.id === "") {
            problems.push(`${at} has no id`);
            continue;
        }
        if (typeof record.why !== "string" || record.why.trim() === "") {
            problems.push(`${at} (${record.id}) has no "why"`);
            continue;
        }
        if (seen.has(record.id)) {
            problems.push(`${at} repeats ${record.id}, which one entry should carry`);
            continue;
        }
        const corrections = FIELDS.filter((field) => typeof record[field] === "string");
        if (corrections.length === 0) {
            problems.push(`${at} (${record.id}) corrects nothing`);
            continue;
        }
        seen.add(record.id);
        const curation: Curation = { id: record.id, why: record.why };
        for (const field of corrections) {
            curation[field] = record[field] as string;
        }
        curations.push(curation);
    }
    return { curations, problems };
}

export async function loadCuration(): Promise<{ curations: Curation[]; problems: string[] }> {
    try {
        return parseCuration(JSON.parse(await readFile(CURATION_FILE, "utf8")));
    } catch (error) {
        // No file at all is a catalogue with nothing to correct, which is a fine state.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { curations: [], problems: [] };
        }
        return { curations: [], problems: [`${CURATION_FILE}: ${(error as Error).message}`] };
    }
}

type Piece = { id: string; title?: string; composer?: string };

// Applies the corrections, and reports which of them found something.
//
// What it does NOT do is decide that an entry matched nothing: corrections are written
// against one catalogue but there are two manifests, songs and exercises, and an entry for
// a study would look unmatched to the songs pass. The caller collects what every pass
// applied and asks `unapplied` once — see below.
export function curate<T extends Piece>(
    pieces: readonly T[],
    curations: readonly Curation[],
): { pieces: T[]; applied: Set<string> } {
    const byId = new Map(curations.map((one) => [one.id, one]));
    const applied = new Set<string>();
    const next = pieces.map((piece) => {
        const curation = byId.get(piece.id);
        if (!curation) {
            return piece;
        }
        applied.add(piece.id);
        const patch: Partial<Piece> = {};
        for (const field of FIELDS) {
            if (curation[field] !== undefined) {
                patch[field] = curation[field];
            }
        }
        return { ...piece, ...patch };
    });
    return { pieces: next, applied };
}

// The corrections that matched nothing anywhere.
//
// An entry whose piece has left the catalogue is an error rather than a no-op: dedup and
// re-import do drop scores, and a correction silently applying to nothing is how this file
// would fill with entries nobody can evaluate. The fix is to delete the line, which
// somebody has to be told to do.
export function unapplied(curations: readonly Curation[], applied: ReadonlySet<string>): string[] {
    return curations
        .filter((one) => !applied.has(one.id))
        .map((one) => `${CURATION_FILE}: ${one.id} is not in the catalogue — remove the entry`);
}
