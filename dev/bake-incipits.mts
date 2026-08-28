// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bakes each shipped song's opening bar into the song manifest, so a list of pieces can
// draw the mark that names them without fetching a single score. A row holds an id and a
// title; notation has to travel with the catalogue or it cannot be there at all.
//
// The cost is a few dozen bytes a piece on a manifest the app already fetches to browse,
// against one .mxl per row otherwise — which is why the mark is baked rather than read.
// Re-runnable: it rewrites the field from the scores on disk every time, in the field
// order the import writes, so a later import yields an identical file.

import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { existsSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const { decompressMxl } = await import("../core/musicxmlFile.ts");

const DIR = "public/songs";

type Entry = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    cost: number;
    license: string;
    source?: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
    incipit?: string;
};

const manifest: Entry[] = JSON.parse(await readFile(`${DIR}/manifest.json`, "utf8"));

// A score sits under its licence bucket — public/songs/<spdx>/<id>.mxl — so the path is
// found, not assumed.
const buckets = readdirSync(DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${DIR}/${entry.name}`);

function scorePath(id: string): string | null {
    for (const bucket of buckets) {
        const path = `${bucket}/${id}.mxl`;
        if (existsSync(path)) {
            return path;
        }
    }
    return null;
}

const baked: Entry[] = [];
let drawn = 0;
let missing = 0;
for (const song of manifest) {
    const path = scorePath(song.id);
    let incipit: string | undefined;
    if (path) {
        const xml = decompressMxl(new Uint8Array(await readFile(path)));
        const read = xml ? readIncipit(linkedomXmlCodec, xml) : null;
        incipit = read ? encodeIncipit(read) : undefined;
    }
    if (incipit) {
        drawn += 1;
    } else {
        // A score whose opening will not read keeps its row and simply shows no mark,
        // so the field is left off rather than written empty.
        missing += 1;
    }
    // Spread, not a field list. This one had already been extended once, for `source`,
    // which is the tell: every field added to the manifest afterwards is dropped silently
    // by a script that rewrites every row and names them one by one. `kind` went that way
    // the first time this ran after it existed.
    //
    // The old incipit is removed rather than left standing, so a piece whose opening no
    // longer reads loses its mark instead of keeping a stale one.
    const { incipit: _previous, ...rest } = song;
    baked.push({ ...rest, ...(incipit === undefined ? {} : { incipit }) });
}

// The manifest ships minified: it is fetched by every browsing visitor, and this
// file is read by machines rather than reviewed by eye.
await writeFile(`${DIR}/manifest.json`, JSON.stringify(baked));

const bytes = (await readFile(`${DIR}/manifest.json`)).byteLength;
console.log(
    `baked ${drawn} incipits (${missing} without one) — manifest now ${(bytes / 1024).toFixed(0)} KB`,
);
