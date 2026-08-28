// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Everything about a shipped exercise that is derived from its notation — what it costs to
// play, the grade that earns, and the opening bars a shelf row draws — recomputed from what
// the repository already holds. A scale or arpeggio tile is regenerated from the config
// stored on its manifest row; a study's MusicXML ships beside the manifest as a .mxl.
// Neither needs the PDMX corpus, so this runs anywhere `npm run songs:bake` runs, CI
// included.
//
// All three come off one read of the notation, and that is the point of them being here
// rather than in three commands. Each is a function of a model that changes: cost of the
// difficulty model, grade of the boundaries, the incipit of the encoder. Refreshing them
// meant running `npm run exercises` and `npm run exercises:incipits`, neither of which has
// any reason to be run after editing core/scoreDifficulty.ts — and one of them needs a 30 GB
// corpus. Both went stale exactly that way, the studies all landing in grade 1 and every
// exercise losing its incipit. Deriving them inside the bake leaves nothing to remember.

import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { gradeOf, pieceBoundaries, rawDifficulty } from "../core/scoreDifficulty.ts";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { gradeForCost } from "./grading.mts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import type { ExerciseConfig } from "../core/exerciseGen.ts";

const { buildExerciseId, generateExercise } = await import("../core/exerciseGen.ts");

const STUDIES = "public/exercises/studies";

export type CostableExercise = { id: string; kind: string; config?: ExerciseConfig };

// The MusicXML hides inside the .mxl zip; META-INF/container.xml names the rootfile.
function readMusicXml(path: string): string {
    const zip = unzipSync(new Uint8Array(readFileSync(path)));
    const container = strFromU8(zip["META-INF/container.xml"] ?? new Uint8Array());
    const named = /full-path="([^"]+)"/.exec(container)?.[1];
    const entry =
        (named ? zip[named] : undefined) ??
        Object.entries(zip).find(
            ([name]) => !name.startsWith("META-INF") && /\.(xml|musicxml)$/i.test(name),
        )?.[1];
    return entry ? strFromU8(entry) : "";
}

// The exercise's notation, or null when the repository cannot produce it — a study whose
// .mxl is missing, or a tile row with no config to rebuild from.
export function exerciseXml(entry: CostableExercise): string | null {
    if (entry.config) {
        return generateExercise(entry.config);
    }
    try {
        const xml = readMusicXml(`${STUDIES}/${entry.id}.mxl`);
        return xml === "" ? null : xml;
    } catch {
        return null;
    }
}

// What the exercise costs to play under the current difficulty model, the grade that cost
// earns, and its opening bars. Null when its notation cannot be produced — in which case
// the caller keeps what the manifest already says rather than grading silence.
//
// The two kinds are graded on different scales, which is the whole reason the category
// exists: fingering a scale costs more than fingering a stepwise tune, so every tile would
// otherwise land below the easiest piece. gradeOf reads the category off the id's prefix,
// so a tile is graded under its rebuilt tile id rather than the content fingerprint the
// manifest row carries.
export function exerciseMeasure(
    entry: CostableExercise,
): { cost: number; grade: number; incipit?: string } | null {
    const xml = exerciseXml(entry);
    if (xml === null) {
        return null;
    }
    const cost = Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3));
    const opening = readIncipit(linkedomXmlCodec, xml);
    const incipit = opening === null ? undefined : encodeIncipit(opening);
    return {
        cost,
        grade: entry.config
            ? gradeOf(linkedomXmlCodec, buildExerciseId(entry.config), xml)
            : gradeForCost(cost, [...pieceBoundaries]),
        // Absent rather than empty when the opening cannot be read, so a row never carries
        // a field that decodes to nothing.
        ...(incipit === undefined ? {} : { incipit }),
    };
}
