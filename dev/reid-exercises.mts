// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// One-shot migration: re-id the finger-exercise catalogue to content-fingerprint ids, the
// same scheme as songs. Studies keep their stored .mxl (renamed to <id>.mxl); generated
// scales/arpeggios get the fingerprint of their generated MusicXML and store their config
// so the app can rebuild them from the id. No regeneration of the study selection — it
// reads the existing manifest. Run: `npm run exercises:reid`.

import { readFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { songId } from "../app/lib/songId.ts";

const { parseExerciseId, generateExercise } = await import("../app/lib/exerciseGen.ts");

const DIR = "public/exercises";
const STUDIES = `${DIR}/studies`;

type ExerciseMeta = { id: string; kind: "scale-arpeggio" | "study"; [key: string]: unknown };

function readMxl(path: string): string {
    const entries = unzipSync(new Uint8Array(readFileSync(path)));
    const container = strFromU8(entries["META-INF/container.xml"] ?? new Uint8Array());
    const root =
        container.match(/full-path="([^"]+)"/)?.[1] ??
        Object.keys(entries).find((name) => name.endsWith(".xml") && !name.startsWith("META-INF"));
    if (!root || !entries[root]) {
        throw new Error("no rootfile");
    }
    return strFromU8(entries[root]);
}

async function main() {
    const manifest: ExerciseMeta[] = JSON.parse(await readFile(`${DIR}/manifest.json`, "utf8"));
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
    await writeFile(`${DIR}/manifest.json`, JSON.stringify(out));
    console.log(`Re-ided ${out.length} exercises.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
