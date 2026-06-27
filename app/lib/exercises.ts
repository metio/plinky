// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { strFromU8, unzipSync } from "fflate";
import type { Score } from "./catalog";
import { exerciseTitle, generateExercise, parseExerciseId } from "./exerciseGen";

// The finger-exercise catalogue. Generated scales/arpeggios are produced on the fly
// from the id's config (zero storage, every form instantly available). Curated
// studies (Hanon, Czerny, Burgmüller, …) are real transcriptions, so each ships as
// a compressed .mxl fetched on open, like songs. The small metadata manifest carries
// precomputed grades and kinds so the library can filter. Built via gen-exercises.mts.

export type ExerciseMeta = {
    id: string;
    title: string;
    grade: number;
    kind: "scale-arpeggio" | "study";
    composer?: string;
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

// A study's MusicXML lives in a compressed .mxl; decompress to the rootfile named by
// META-INF/container.xml.
async function fetchStudyXml(cid: string): Promise<string | null> {
    try {
        const response = await fetch(`/exercises/studies/${cid}.mxl`);
        if (!response.ok) {
            return null;
        }
        const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
        const container = strFromU8(entries["META-INF/container.xml"] ?? new Uint8Array());
        const root =
            container.match(/full-path="([^"]+)"/)?.[1] ??
            Object.keys(entries).find(
                (name) => name.endsWith(".xml") && !name.startsWith("META-INF"),
            );
        return root && entries[root] ? strFromU8(entries[root]) : null;
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
        bundled: true,
    };
}
