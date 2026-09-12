// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two things `npm run songs:bake` verifies before it derives anything, kept apart from
// the command that runs them so they can be tested without baking the catalogue.
//
// Both answer the same question from opposite ends: does what the manifests store still
// come from the models that are in the tree? Cost comes from the difficulty model, the
// incipit from its encoder, and the scale and arpeggio grades from boundaries that do not
// follow either. Every one of them is a number somebody could change without touching the
// catalogue, and grades derived from stale ones are wrong in a way nothing downstream sees.

import { readFile } from "node:fs/promises";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { scorePath } from "./manifest.mts";

const _SONGS = "public/songs";

export type ProbeSong = {
    id: string;
    cost: number;
    license?: string;
    title?: string;
    incipit?: string;
};

// The share of one category's tiles that may sit in a single grade before the boundaries
// are judged to have stopped separating them. Set loosely: an uneven curriculum is normal,
// a collapsed one is a broken scale.
const CROWDED_SHARE = 0.5;

// The category whose tiles have collapsed into one grade, described; null when each
// category is still spread.
export function crowdedGrade(exercises: { kind: string; grade: number }[]): string | null {
    const tiles = exercises.filter((entry) => entry.kind === "scale-arpeggio");
    if (tiles.length === 0) {
        return null;
    }
    const perGrade = new Map<number, number>();
    for (const tile of tiles) {
        perGrade.set(tile.grade, (perGrade.get(tile.grade) ?? 0) + 1);
    }
    for (const [grade, count] of perGrade) {
        if (count > tiles.length * CROWDED_SHARE) {
            return `${count} of ${tiles.length} scale, arpeggio and chord tiles are grade ${grade}`;
        }
    }
    return null;
}

// How many songs to re-derive, spread across the catalogue, as a check that what the
// manifest stores still comes from the current models — the difficulty model for cost, the
// encoder for the incipit. The exercises are re-derived outright because they are few; the
// songs only have to be caught, in seconds rather than the half-hour re-deriving three
// thousand scores takes.
const SONG_PROBES = 24;

// The staves each part of a score is written on, in score order — "2" for a grand staff,
// "1,2" for a song over its piano, "1,1" for a piano written as two parts. Read off the
// text, since parsing every score in the catalogue to choose a handful of probes would
// cost what the probes exist to save. It mirrors stavesPerPart in core/accompaniment.ts,
// which the test holds it to; it only chooses which songs to probe, so a misreading
// could make the spread less varied but never a verdict wrong.
export function layoutOf(xml: string): string {
    // A score written measure by measure nests its parts inside each measure, where the
    // model reads no part at all.
    if (xml.includes("<score-timewise")) {
        return "";
    }
    const counts: number[] = [];
    const opening = /<part[\s>]/g;
    for (let found = opening.exec(xml); found !== null; found = opening.exec(xml)) {
        const end = xml.indexOf("</part>", found.index);
        const body = xml.slice(found.index, end === -1 ? undefined : end);
        const stated = /<staves>\s*(\d+)\s*<\/staves>/.exec(body)?.[1];
        const count = stated === undefined ? Number.NaN : Number.parseInt(stated, 10);
        counts.push(Number.isInteger(count) && count > 0 ? count : 1);
        opening.lastIndex = end === -1 ? xml.length : end;
    }
    return counts.join(",");
}

// Which rows to re-derive, by index, given each row's part layout: a spread across the
// catalogue, and then the first row of every layout the spread did not reach.
//
// A spread alone assumes a model change moves essentially every row. Many do; some are
// confined to one way of writing a score. Reading two single-staff parts as both hands
// moved about one row in a hundred, which a spread of two dozen misses three times in
// four — and the manifest stayed stale for days behind a green check. Each layout the
// catalogue holds is somewhere a change can be confined to, so each gets a probe.
export function probeIndices(layouts: readonly string[]): number[] {
    const chosen = new Set<number>();
    const step = Math.max(1, Math.floor(layouts.length / SONG_PROBES));
    for (let i = 0; i < layouts.length; i += step) {
        chosen.add(i);
    }
    const reached = new Set([...chosen].map((index) => layouts[index]));
    for (const [index, layout] of layouts.entries()) {
        if (!reached.has(layout)) {
            reached.add(layout);
            chosen.add(index);
        }
    }
    return [...chosen].sort((a, b) => a - b);
}

// A song's shipped score, or what stands in the way of reading it.
export type ShippedScore = { xml: string } | { problem: "missing" | "unreadable" };

export async function shippedScore(song: ProbeSong): Promise<ShippedScore> {
    const { decompressMxl } = await import("../core/musicxmlFile.ts");
    const path = scorePath(song.id, song.license);
    const bytes = path === null ? null : await readFile(path).catch(() => null);
    if (!bytes) {
        return { problem: "missing" };
    }
    const xml = decompressMxl(new Uint8Array(bytes));
    return xml ? { xml } : { problem: "unreadable" };
}

// What the models in the tree make of a score: the cost the manifest stores, rounded as
// it is stored, and the incipit. A score whose opening cannot be read has no incipit,
// legitimately.
export function currentMeasure(xml: string): { cost: number; incipit: string | undefined } {
    const opening = readIncipit(linkedomXmlCodec, xml);
    return {
        cost: Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3)),
        incipit: opening === null ? undefined : encodeIncipit(opening),
    };
}

// Re-derives the probed songs and names the first whose stored values no longer match.
// Null when the manifest is current. Every score is read, to learn its layout, so a row
// naming a score that is not shipped or cannot be read is named wherever it stands: a row
// the app cannot open is a problem, not a probe to skip.
export async function staleSong(
    songs: ProbeSong[],
    read: (song: ProbeSong) => Promise<ShippedScore> = shippedScore,
    measure: (xml: string) => { cost: number; incipit: string | undefined } = currentMeasure,
): Promise<string | null> {
    const scores: string[] = [];
    for (const song of songs) {
        const score = await read(song);
        const named = song.title ?? song.id;
        if ("problem" in score) {
            return score.problem === "missing"
                ? `${named} (${song.id}) has no .mxl under public/songs — the manifest names a score that is not shipped`
                : `${named} (${song.id}) has an .mxl that cannot be read`;
        }
        scores.push(score.xml);
    }
    for (const index of probeIndices(scores.map(layoutOf))) {
        const song = songs[index]!;
        const named = song.title ?? song.id;
        const fresh = measure(scores[index]!);
        if (fresh.cost !== song.cost) {
            return `${named} is stored at cost ${song.cost} but measures ${fresh.cost} — run \`npm run songs:cost\``;
        }
        // Absence is only wrong when the encoder does produce an incipit.
        if (fresh.incipit !== song.incipit) {
            return `${named} carries an incipit the encoder no longer produces — run \`npm run songs:incipits\``;
        }
    }
    return null;
}
