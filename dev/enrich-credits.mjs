// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Applies dev/creditOverrides.mjs to the shipped catalogue: the manifest's
// composer field (what the library shows) and the .mxl's own composer creator
// (what the play page reads once the piece opens). Idempotent — run it after
// any re-import to reapply the curated credits. The song id fingerprints only
// the notes, so rewriting metadata never moves an id.
// Run from the repo root: node dev/enrich-credits.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { CREDIT_OVERRIDES } from "./creditOverrides.mjs";
import { readSongsSync, scorePath, writeSongsSync } from "./manifest.mts";

const manifest = readSongsSync();

let patchedManifest = 0;
let patchedFiles = 0;

function patchXml(xml, composer) {
    const escaped = composer
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    if (/<creator type="composer">[\s\S]*?<\/creator>/.test(xml)) {
        return xml.replace(
            /<creator type="composer">[\s\S]*?<\/creator>/,
            `<creator type="composer">${escaped}</creator>`,
        );
    }
    if (/<identification>/.test(xml)) {
        return xml.replace(
            "<identification>",
            `<identification><creator type="composer">${escaped}</creator>`,
        );
    }
    return xml.replace(
        /(<score-partwise[^>]*>)/,
        `$1<identification><creator type="composer">${escaped}</creator></identification>`,
    );
}

for (const song of manifest) {
    const composer = CREDIT_OVERRIDES[song.id];
    if (!composer) {
        continue;
    }
    if (song.composer !== composer) {
        song.composer = composer;
        patchedManifest++;
    }
    const mxlPath = scorePath(song.id, song.license);
    if (mxlPath === null) {
        console.warn(`  ${song.id}: no .mxl shipped, credit left as it is in the file`);
        continue;
    }
    const entries = unzipSync(new Uint8Array(readFileSync(mxlPath)));
    let changed = false;
    for (const [name, bytes] of Object.entries(entries)) {
        if (!/\.(xml|musicxml)$/.test(name) || name.startsWith("META-INF")) {
            continue;
        }
        const xml = strFromU8(bytes);
        const patched = patchXml(xml, composer);
        if (patched !== xml) {
            entries[name] = strToU8(patched);
            changed = true;
        }
    }
    if (changed) {
        writeFileSync(mxlPath, zipSync(entries));
        patchedFiles++;
    }
}

writeSongsSync(manifest);
console.log(
    `enrich-credits: ${patchedManifest} manifest entries updated, ${patchedFiles} .mxl files rewritten (${Object.keys(CREDIT_OVERRIDES).length} overrides).`,
);
