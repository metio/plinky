// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DEFAULT_SONG_SOURCE } from "./attribution";
import type { Score } from "./catalog";
import { exerciseTitle, generateExercise, parseExerciseId } from "./exerciseGen";
import { decompressMxl } from "./musicxmlFile";

// The finger-exercise catalogue. Generated scales/arpeggios are produced on the fly
// from the id's config (zero storage, every form instantly available). Curated
// studies (Hanon, Czerny, Burgmüller, …) are real transcriptions, so each ships as
// a compressed .mxl fetched on open, like songs. The small metadata manifest carries
// precomputed grades and kinds so the library can filter. Built via gen-exercises.mts.

export type ExerciseMeta = {
    id: string;
    title: string;
    grade: number;
    // The raw fingering-cost the grade was binned from; orders a grade's items
    // easiest-first and feeds the skill rating uniformly across songs and exercises.
    cost: number;
    kind: "scale-arpeggio" | "study";
    composer?: string;
    // Curated studies are public-domain transcriptions from PDMX (CC0); generated
    // scales/arpeggios are our own and carry no external licence.
    license?: string;
    tempo: number;
    beatsPerBar: number;
};

const MANIFEST_URL = "/exercises/manifest.json";

let manifestCache: ExerciseMeta[] | null = null;

export async function loadExerciseManifest(): Promise<ExerciseMeta[]> {
    if (manifestCache) {
        return manifestCache;
    }
    try {
        const response = await fetch(MANIFEST_URL);
        manifestCache = response.ok ? ((await response.json()) as ExerciseMeta[]) : [];
    } catch {
        manifestCache = [];
    }
    return manifestCache;
}

// A study's MusicXML lives in a compressed .mxl; decompress it to the score string.
async function fetchStudyXml(cid: string): Promise<string | null> {
    try {
        const response = await fetch(`/exercises/studies/${cid}.mxl`);
        if (!response.ok) {
            return null;
        }
        return decompressMxl(new Uint8Array(await response.arrayBuffer()));
    } catch {
        return null;
    }
}

// Resolve an exercise id to a playable Score. Generated scales/arpeggios are built
// synchronously from the config; study ids (study-<cid>) fetch their .mxl. The play
// flow falls back to this for ids that are neither bundled, user, nor song scores.
export async function resolveExercise(id: string): Promise<Score | null> {
    const config = parseExerciseId(id);
    if (config) {
        return {
            id,
            title: exerciseTitle(config),
            composer: "",
            description: "",
            xml: generateExercise(config),
            tempo: 90,
            beatsPerBar: 4,
            // Generated from a config at runtime — our own work, dedicated to the
            // public domain. No external source to credit.
            license: "CC0-1.0",
            bundled: true,
        };
    }
    if (!id.startsWith("study-")) {
        return null;
    }
    const xml = await fetchStudyXml(id.slice("study-".length));
    if (xml === null) {
        return null;
    }
    const meta = (await loadExerciseManifest()).find((exercise) => exercise.id === id);
    return {
        id,
        title: meta?.title ?? "Study",
        composer: meta?.composer ?? "",
        description: "",
        xml,
        tempo: 90,
        beatsPerBar: 4,
        // The studies are public-domain études imported from PDMX; default the
        // credit so it shows even on a manifest predating the license field.
        license: meta?.license ?? "CC0-1.0",
        source: DEFAULT_SONG_SOURCE,
        bundled: true,
    };
}
