// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The same mark the songs carry, for the exercises. A shelf that draws the opening of
// every tune and nothing at all beside the scales and studies reads as two lists that
// happened to be stacked; with the marks it reads as one shelf of music, and the shape of
// a scale — a straight run of steps — tells a reader what it is before the title does.
//
// A generated scale or arpeggio is regenerated from the config the manifest already
// carries; a curated study is read from its .mxl. Re-runnable: it rewrites the field from
// what is on disk every time, in the field order the generator writes.

import { generateExercise } from "../core/exerciseGen.ts";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const { decompressMxl } = await import("../core/musicxmlFile.ts");

const PATH = "public/exercises/manifest.json";
const STUDIES = "public/exercises/studies";

type Entry = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: "scale-arpeggio" | "study";
    config?: Record<string, unknown>;
    composer?: string;
    license?: string;
    tempo: number;
    beatsPerBar: number;
    incipit?: string;
};

const manifest: Entry[] = JSON.parse(await readFile(PATH, "utf8"));

async function xmlFor(entry: Entry): Promise<string | null> {
    if (entry.kind === "scale-arpeggio" && entry.config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the manifest's
        // config is the same shape generateExercise takes; it round-trips through JSON.
        return generateExercise(entry.config as never);
    }
    const path = `${STUDIES}/${entry.id}.mxl`;
    if (!existsSync(path)) {
        return null;
    }
    return decompressMxl(new Uint8Array(await readFile(path)));
}

const baked: Entry[] = [];
let drawn = 0;
let missing = 0;
for (const entry of manifest) {
    const xml = await xmlFor(entry);
    const read = xml ? readIncipit(linkedomXmlCodec, xml) : null;
    const incipit = read ? encodeIncipit(read) : undefined;
    if (incipit) {
        drawn += 1;
    } else {
        missing += 1;
    }
    baked.push({
        id: entry.id,
        title: entry.title,
        grade: entry.grade,
        cost: entry.cost,
        kind: entry.kind,
        ...(entry.config === undefined ? {} : { config: entry.config }),
        ...(entry.composer === undefined ? {} : { composer: entry.composer }),
        ...(entry.license === undefined ? {} : { license: entry.license }),
        tempo: entry.tempo,
        beatsPerBar: entry.beatsPerBar,
        ...(incipit === undefined ? {} : { incipit }),
    });
}

await writeFile(PATH, JSON.stringify(baked));

const bytes = (await readFile(PATH)).byteLength;
console.log(
    `baked ${drawn} exercise incipits (${missing} without one) — manifest now ${(bytes / 1024).toFixed(1)} KB`,
);
