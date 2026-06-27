// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { gunzipSync, strFromU8 } from "fflate";
import type { Score } from "./catalog";
import { exerciseTitle, generateExercise, parseExerciseId } from "./exerciseGen";

// The finger-exercise catalogue. Generated scales/arpeggios are produced on the fly
// from the id's config (zero storage, every form instantly available); the small
// metadata manifest carries precomputed grades so the library can filter without
// generating every row. Hanon exercises are real transcriptions, so their MusicXML
// ships in a gzipped pack fetched once. The build emits both via dev/gen-exercises.mts.

export type ExerciseMeta = {
    id: string;
    title: string;
    grade: number;
    tempo: number;
    beatsPerBar: number;
};

const MANIFEST_URL = "/exercises/manifest.json";
const HANON_URL = "/exercises/hanon.json.gz";

let manifestCache: ExerciseMeta[] | null = null;
let hanonPromise: Promise<Record<string, string>> | null = null;

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

// Fetch + decompress the Hanon pack once; concurrent callers share the request.
function loadHanon(): Promise<Record<string, string>> {
    if (!hanonPromise) {
        hanonPromise = (async () => {
            try {
                const response = await fetch(HANON_URL);
                if (!response.ok) {
                    return {};
                }
                const bytes = new Uint8Array(await response.arrayBuffer());
                return JSON.parse(strFromU8(gunzipSync(bytes))) as Record<string, string>;
            } catch {
                return {};
            }
        })();
    }
    return hanonPromise;
}

// Resolve an exercise id to a playable Score. Generated scales/arpeggios are built
// synchronously from the config; Hanon ids come from the pack. The play flow falls
// back to this for ids that are neither bundled, user, nor song scores.
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
    const xml = (await loadHanon())[id];
    if (!xml) {
        return null;
    }
    const meta = (await loadExerciseManifest()).find((exercise) => exercise.id === id);
    return {
        id,
        title: meta?.title ?? "Exercise",
        composer: "",
        description: "",
        xml,
        tempo: 90,
        beatsPerBar: 4,
        bundled: true,
    };
}
