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
import { canonicalComposer } from "../../core/person.ts";
import { folderFor, slug } from "./pieces.mjs";

const SETS = "public/songs/builtin-assignments.json";
const MANIFEST = "public/songs/manifest.json";

// A collection's folder, beside the per-composer ones. Prefixed so a set called "Preludes"
// cannot land on a composer of the same slug.
export function folderForCollection(set) {
    return `collections/${slug(set.id)}`;
}

// Every collection, with the pieces of it that may actually be posted.
//
// `held` is how many the catalogue has in total, so a caller can say "eleven of the
// fifteen" rather than quietly publishing eleven and calling it the inventions.
//
// The pieces come back already carrying their variants, so a playlist names the file the
// renderer actually wrote. Doing it in one of the two and not the other would be worse than
// not doing it at all: the clips would land in folders of their own while every playlist
// went on pointing at the one path they used to share.
export function collections() {
    const sets = JSON.parse(readFileSync(SETS, "utf8"));
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    const byId = new Map(manifest.map((song) => [song.id, song]));
    const built = sets
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
                    // The spelling the app shows, not the one the corpus supplied. A credit
                    // is burnt into every frame of the clip, and the catalogue holds Debussy
                    // as "DebussyC", Czerny with an opus number welded on, and Joplin in
                    // four capitalisations — each of which the alias table already resolves
                    // everywhere a person is named on screen. This was the one surface still
                    // asking the raw string, and it is the least correctable: a folder can be
                    // renamed, a video cannot.
                    composer: canonicalComposer(song.composer),
                })),
            };
        })
        .filter((set) => set.pieces.length > 0);
    const shared = sharedFolders(built.flatMap((set) => set.pieces));
    return built.map((set) => ({
        ...set,
        pieces: set.pieces.map((piece) =>
            shared.has(folderFor(piece)) ? { ...piece, variant: piece.id } : piece,
        ),
    }));
}

// The folder paths more than one piece wants, over every collection at once.
//
// Across all of them rather than within each, because a piece may be named by two sets and
// the answer has to be the same in both — a clip is rendered once and both playlists point
// at it.
//
// It has to be asked at all because the curated shelf is hand-written, where each entry
// earns a title that tells it from its neighbours, and a collection is whatever the
// catalogue holds: six movements of the fifth French Suite under six identical titles,
// seven studies from Op. 740 under one, and every Chopin prelude simply "Prelude". Folder
// names are cut from the title, so those collapse — a hundred and eighty-two pieces owned a
// hundred and forty-one folders, and forty-one clips would each have been written over by
// the next one to render, silently, hours in, by a run that then reported success.
function sharedFolders(pieces) {
    const once = new Set();
    const shared = new Set();
    for (const piece of pieces) {
        const path = folderFor(piece);
        if (once.has(path)) {
            shared.add(path);
        }
        once.add(path);
    }
    return shared;
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
    return pieces;
}
