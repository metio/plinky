// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DEFAULT_SONG_SOURCE } from "../../core/attribution";
import type { Score } from "./catalog";
import { type ExerciseConfig, exerciseTitle, generateExercise } from "../../core/exerciseGen";
import { decompressMxl } from "../../core/musicxmlFile";

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
    // A generated scale/arpeggio carries its config so it can be regenerated from the id
    // (the id is a content fingerprint now, not a parseable "scale-c-major" slug).
    config?: ExerciseConfig;
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

// A study's MusicXML lives in a compressed .mxl named by its fingerprint id; decompress
// the fetched bytes to the score string.
async function fetchStudyXml(id: string): Promise<string | null> {
    try {
        const response = await fetch(`/exercises/studies/${id}.mxl`);
        if (!response.ok) {
            return null;
        }
        return decompressMxl(new Uint8Array(await response.arrayBuffer()));
    } catch {
        return null;
    }
}

// Resolve an exercise id to a playable Score. Every playable piece shares one id scheme (a
// content fingerprint), so this looks the id up in the manifest: a generated scale/arpeggio
// is rebuilt from its stored config; a study fetches its .mxl. Returns null for ids that are
// not exercises, so the play flow falls through to bundled, user or song scores.
export async function resolveExercise(id: string): Promise<Score | null> {
    const meta = (await loadExerciseManifest()).find((exercise) => exercise.id === id);
    if (!meta) {
        return null;
    }
    if (meta.kind === "scale-arpeggio" && meta.config) {
        return {
            id,
            title: exerciseTitle(meta.config),
            composer: "",
            description: "",
            xml: generateExercise(meta.config),
            tempo: meta.tempo,
            beatsPerBar: meta.beatsPerBar,
            // Generated from a config at runtime — our own work, dedicated to the public
            // domain. No external source to credit.
            license: "CC0-1.0",
            bundled: true,
        };
    }
    const xml = await fetchStudyXml(id);
    if (xml === null) {
        return null;
    }
    return {
        id,
        title: meta.title,
        composer: meta.composer ?? "",
        description: "",
        xml,
        tempo: meta.tempo,
        beatsPerBar: meta.beatsPerBar,
        // The studies are public-domain études imported from PDMX; default the credit so
        // it shows even on a manifest predating the license field.
        license: meta.license ?? "CC0-1.0",
        source: DEFAULT_SONG_SOURCE,
        bundled: true,
    };
}
