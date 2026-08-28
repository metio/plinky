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

import { readdir, readFile } from "node:fs/promises";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";

const SONGS = "public/songs";

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
            return `${count} of ${tiles.length} scale and arpeggio tiles are grade ${grade}`;
        }
    }
    return null;
}

// How many songs to re-derive as a check that what the manifest stores still comes from
// the current models — the difficulty model for cost, the encoder for the incipit.
//
// A change to either moves essentially every row, so a handful spread across the catalogue
// detects one with certainty, in a second rather than the half-hour re-deriving three
// thousand scores takes. The exercises are re-derived outright because they are few; the
// songs only have to be caught.
const SONG_PROBES = 24;

// Re-derives a spread of songs and names the first whose stored values no longer match.
// Null when the manifest is current, or when no score could be read to judge by.
export async function staleSong(songs: ProbeSong[]): Promise<string | null> {
    if (songs.length === 0) {
        return null;
    }
    const { decompressMxl } = await import("../core/musicxmlFile.ts");
    const buckets = (await readdir(SONGS, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    const step = Math.max(1, Math.floor(songs.length / SONG_PROBES));
    for (let i = 0; i < songs.length; i += step) {
        const song = songs[i]!;
        const bucket = song.license?.toLowerCase();
        const paths = bucket ? [bucket, ...buckets] : buckets;
        let bytes: Buffer | null = null;
        for (const path of paths) {
            bytes = await readFile(`${SONGS}/${path}/${song.id}.mxl`).catch(() => null);
            if (bytes) {
                break;
            }
        }
        if (!bytes) {
            continue;
        }
        const xml = decompressMxl(new Uint8Array(bytes));
        if (!xml) {
            continue;
        }
        const named = song.title ?? song.id;
        const fresh = Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3));
        if (fresh !== song.cost) {
            return `${named} is stored at cost ${song.cost} but measures ${fresh} — run \`npm run songs:cost\``;
        }
        // A score whose opening cannot be read has no incipit, legitimately, so absence is
        // only wrong when the encoder does produce one.
        const opening = readIncipit(linkedomXmlCodec, xml);
        const incipit = opening === null ? undefined : encodeIncipit(opening);
        if (incipit !== song.incipit) {
            return `${named} carries an incipit the encoder no longer produces — run \`npm run songs:incipits\``;
        }
    }
    return null;
}
