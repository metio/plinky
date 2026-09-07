// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The addresses the site can actually answer under /play and /person, written beside the
// site for the edge middleware to read (functions/_middleware.js).
//
// A page with no prerendered document renders on the client, so the static host answers
// its address with a 404 and the middleware corrects that to a 200. Corrected for every
// address, that also blesses a piece that never existed, an id from a scheme the
// catalogue left behind, a composer whose spelling was merged into another's: a crawler
// gets a 200 with an empty shell and records a soft 404, and a search index learns not to
// trust the site's own answers. This file is what tells a real page from a missing one.
//
// Written by the build rather than at deploy because the composer index and the bundled
// pieces are TypeScript modules, and the deploy runs with nothing installed.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PEOPLE_INDEX } from "../core/peopleIndex.ts";
import { personSlugs } from "../core/person.ts";
import { readScoreMetaFromText } from "../core/scoreMeta.ts";
import { songId } from "../core/songId.ts";

const OUT = "build/client";
// The bundled pieces, read from their files the way the app inlines them: the same
// content-fingerprint id and the same credit, without reaching into the app's layer.
const BUNDLED = "scores";

function bundledPieces(): { id: string; composer: string }[] {
    return readdirSync(BUNDLED)
        .filter((name) => name.endsWith(".musicxml"))
        .map((name) => {
            const xml = readFileSync(`${BUNDLED}/${name}`, "utf8");
            return { id: songId(xml), composer: readScoreMetaFromText(xml).composer };
        });
}

export type KnownIds = { pieces: string[]; people: string[] };

export function knownIds(): KnownIds {
    const songs = JSON.parse(readFileSync("public/songs/manifest.json", "utf8")) as {
        id: string;
        composer: string;
    }[];
    const exercises = JSON.parse(readFileSync("public/exercises/manifest.json", "utf8")) as {
        id: string;
    }[];
    const bundled = bundledPieces();
    const pieces = new Set<string>([
        ...songs.map((song) => song.id),
        ...exercises.map((exercise) => exercise.id),
        ...bundled.map((score) => score.id),
    ]);
    // Every composer credited anywhere resolves to a page, whether the index lists them
    // (it holds the people above its floor) or the page is built from the pieces alone.
    const people = new Set<string>(Object.keys(PEOPLE_INDEX));
    for (const credit of [...songs.map((s) => s.composer), ...bundled.map((s) => s.composer)]) {
        for (const slug of personSlugs(credit)) {
            if (slug) {
                people.add(slug);
            }
        }
    }
    return { pieces: [...pieces].sort(), people: [...people].sort() };
}

export function writeKnownIds(out = OUT): KnownIds {
    const known = knownIds();
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/known.json`, JSON.stringify(known));
    return known;
}

if (process.argv[1]?.endsWith("gen-known-ids.mts")) {
    const { pieces, people } = writeKnownIds();
    console.log(`known.json: ${pieces.length} pieces, ${people.length} people.`);
}
