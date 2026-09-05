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
import { readFile } from "node:fs/promises";
import type { SongMeta } from "../core/catalogMeta.ts";
import { readSongs, scorePath, SONGS_MANIFEST, writeSongs } from "./manifest.mts";

const { decompressMxl } = await import("../core/musicxmlFile.ts");

const _DIR = "public/songs";

const manifest = await readSongs();

const baked: SongMeta[] = [];
let drawn = 0;
let missing = 0;
for (const song of manifest) {
    const path = scorePath(song.id, song.license);
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
await writeSongs(baked);

const bytes = (await readFile(SONGS_MANIFEST)).byteLength;
console.log(
    `baked ${drawn} incipits (${missing} without one) — manifest now ${(bytes / 1024).toFixed(0)} KB`,
);
