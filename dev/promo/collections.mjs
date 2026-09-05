// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The named works as sets of pieces to render and publish — one YouTube playlist each.
//
// Plinky already knows these: they are the built-in assignments, resolved from the
// catalogue by `npm run songs:bake` into public/songs/builtin-assignments.json. Reading
// that file rather than a second hand-written list is the point — a playlist and the
// assignment a player works through are then the same set of pieces by construction, and
// somebody who never opens Plinky can still work through Burgmüller in order.
//
// Only CC0 pieces are eligible, as everywhere else in the promo pipeline: the catalogue's
// CC-BY-SA scores carry share-alike, which travels with a video, and a feed is the worst
// place to argue about it. That is why a collection can publish short of the work it names
// — the description says so rather than pretending otherwise.

import { readFileSync } from "node:fs";
import { folderFor, slug } from "./pieces.mjs";
import { readSongsSync } from "../manifest.mts";

const SETS = "public/songs/builtin-assignments.json";

// A collection's folder, beside the per-composer ones. Prefixed so a set called "Preludes"
// cannot land on a composer of the same slug.
export function folderForCollection(set) {
    return `collections/${slug(set.id)}`;
}

// Every collection, with the pieces of it that may actually be posted.
//
// `held` is how many the catalogue has in total, so a caller can say "eleven of the
// fifteen" rather than quietly publishing eleven and calling it the inventions.
export function collections() {
    const sets = JSON.parse(readFileSync(SETS, "utf8"));
    const manifest = readSongsSync();
    const byId = new Map(manifest.map((song) => [song.id, song]));
    return sets
        .map((set) => {
            const songs = set.items.map((id) => byId.get(id)).filter(Boolean);
            const postable = songs.filter((song) => song.license === "CC0-1.0");
            return {
                id: set.id,
                name: set.name,
                held: songs.length,
                pieces: postable.map((song) => ({
                    id: song.id,
                    title: song.title,
                    composer: song.composer,
                })),
            };
        })
        .filter((set) => set.pieces.length > 0);
}

// Every piece to render, once, however many collections name it. A piece in two sets is
// still one video; the playlists both point at it.
export function collectionPieces() {
    const seen = new Set();
    const pieces = [];
    for (const set of collections()) {
        for (const piece of set.pieces) {
            if (seen.has(piece.id)) {
                continue;
            }
            seen.add(piece.id);
            pieces.push(piece);
        }
    }
    // The movements of one work share a title in the manifest — six of a French Suite,
    // five of an opus of studies — and the folder is composer and title, so they would
    // all render to one path, each overwriting the last and the stamp beside it vouching
    // for whichever came last. A repeated folder gets the piece's id on the end, and a
    // path still taken after that is a list to look at, not a render to run.
    const wanted = new Map();
    for (const piece of pieces) {
        const path = folderFor(piece);
        wanted.set(path, (wanted.get(path) ?? 0) + 1);
    }
    const taken = new Set();
    for (const piece of pieces) {
        const path = folderFor(piece);
        if ((wanted.get(path) ?? 0) > 1) {
            piece.folder = `${path}-${piece.id.toLowerCase()}`;
        }
        const final = folderFor(piece);
        if (taken.has(final)) {
            throw new Error(`two collection pieces both want promo/${final}`);
        }
        taken.add(final);
    }
    return pieces;
}
