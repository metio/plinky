// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DEFAULT_SONG_SOURCE } from "../../core/attribution";
import {
    type ExerciseConfig,
    exerciseTitle,
    generateExercise,
    parseExerciseId,
} from "../../core/exerciseGen";
import type { Fetcher } from "../ports/fetcher";
import { cachedManifest, fetchMxlXml, type ResolvedScore } from "./manifest";

// The finger-exercise catalogue. Generated scales/arpeggios are produced on the
// fly from the id's config (zero storage, every form instantly available).
// Curated studies (Hanon, Czerny, Burgmüller, …) are real transcriptions, so
// each ships as a compressed .mxl fetched on open, like songs. The small
// metadata manifest carries precomputed grades and kinds so the library can
// filter. Built via gen-exercises.mts, over the injected network seam.

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

// Tempo and metre for an exercise generated on demand (an arcade rung past the curated
// manifest): the same steady scale tempo and common time every manifest scale carries.
const GENERATED_TEMPO = 90;
const GENERATED_BEATS = 4;

// A generated scale/arpeggio as a playable score — our own work at runtime, so it credits
// no external source and rides into the public domain like the manifest's own generated set.
function generatedExercise(
    id: string,
    config: ExerciseConfig,
    tempo: number,
    beatsPerBar: number,
): ResolvedScore {
    return {
        id,
        title: exerciseTitle(config),
        composer: "",
        description: "",
        xml: generateExercise(config),
        tempo,
        beatsPerBar,
        license: "CC0-1.0",
        bundled: true,
    };
}

export type ExerciseSource = {
    // The browsable metadata list, or null when the fetch failed — callers that
    // only display may treat null as empty, but "unreachable" must never read
    // as "these pieces no longer exist".
    manifest(): Promise<ExerciseMeta[] | null>;
    // An exercise id as a playable Score: a generated scale/arpeggio is rebuilt
    // from its stored config, a study fetches its .mxl. Null for ids that are
    // not exercises, so the play flow falls through to the other sources;
    // "unavailable" when a fetch failed and the answer is simply unknown.
    resolve(id: string): Promise<ResolvedScore>;
};

export function createExerciseSource(fetchUrl: Fetcher): ExerciseSource {
    const manifest = cachedManifest<ExerciseMeta>(fetchUrl, MANIFEST_URL);

    // A study's MusicXML lives in a compressed .mxl named by its fingerprint id.
    const fetchStudyXml = (id: string): Promise<string | null> =>
        fetchMxlXml(fetchUrl, `/exercises/studies/${id}.mxl`);

    return {
        manifest,
        async resolve(id) {
            const list = await manifest();
            if (list === null) {
                return "unavailable";
            }
            const meta = list.find((exercise) => exercise.id === id);
            if (!meta) {
                // Not curated in the manifest — but a valid scale/arpeggio id can still be
                // generated on demand, so the sight-reading arcade climbs beyond the
                // handful the manifest names. An id that isn't a valid config is genuinely
                // absent. Generated exercises share the manifest's scale tempo and metre.
                const config = parseExerciseId(id);
                return config
                    ? generatedExercise(id, config, GENERATED_TEMPO, GENERATED_BEATS)
                    : null;
            }
            if (meta.kind === "scale-arpeggio" && meta.config) {
                return generatedExercise(id, meta.config, meta.tempo, meta.beatsPerBar);
            }
            const xml = await fetchStudyXml(id);
            if (xml === null) {
                // The manifest names this study, so the piece exists — only its
                // .mxl could not be fetched right now.
                return "unavailable";
            }
            return {
                id,
                title: meta.title,
                composer: meta.composer ?? "",
                description: "",
                xml,
                tempo: meta.tempo,
                beatsPerBar: meta.beatsPerBar,
                // The studies are public-domain études imported from PDMX; default the
                // credit so it shows even on a manifest predating the license field.
                license: meta.license ?? "CC0-1.0",
                source: DEFAULT_SONG_SOURCE,
                bundled: true,
            };
        },
    };
}
