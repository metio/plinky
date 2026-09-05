// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One-shot migration: re-id the finger-exercise catalogue to content-fingerprint ids, the
// same scheme as songs. Studies keep their stored .mxl (renamed to <id>.mxl); generated
// scales/arpeggios get the fingerprint of their generated MusicXML and store their config
// so the app can rebuild them from the id. No regeneration of the study selection — it
// reads the existing manifest. Run: `npm run exercises:reid`.

import { readFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { songId } from "../core/songId.ts";
import type { ExerciseMeta } from "../core/catalogMeta.ts";
import { readExercises, writeExercises } from "./manifest.mts";

const { parseExerciseId, generateExercise } = await import("../core/exerciseGen.ts");

const DIR = "public/exercises";
const STUDIES = `${DIR}/studies`;

function readMxl(path: string): string {
    const xml = decompressMxl(new Uint8Array(readFileSync(path)));
    if (xml === null) {
        throw new Error(`no rootfile in ${path}`);
    }
    return xml;
}

async function main() {
    const manifest = await readExercises();
    const out: ExerciseMeta[] = [];
    for (const exercise of manifest) {
        if (exercise.kind === "scale-arpeggio") {
            const config = parseExerciseId(exercise.id);
            if (!config) {
                console.error(`  unparsable scale id ${exercise.id}`);
                continue;
            }
            out.push({ ...exercise, id: songId(generateExercise(config)), config });
        } else {
            const cid = exercise.id.replace(/^study-/, "");
            const xml = readMxl(`${STUDIES}/${cid}.mxl`);
            const id = songId(xml);
            await rename(`${STUDIES}/${cid}.mxl`, `${STUDIES}/${id}.mxl`);
            out.push({ ...exercise, id });
        }
    }
    await writeExercises(out);
    console.log(`Re-ided ${out.length} exercises.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
