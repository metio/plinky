// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `npm run songs:movements` — the catalogue titles that name several pieces at once, with
// what each of those scores prints about itself.
//
// A report, not a gate. It finds where a title has stopped telling one piece from another
// and gathers the evidence for fixing it; the fix is a curation entry, which is a decision
// somebody makes. Running it after an import is how that work stays a morning rather than
// an archaeology.

import { readFileSync } from "node:fs";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { canonicalComposer } from "../core/person.ts";
import { movementCandidates } from "./movementTitles.mts";

type Song = { id: string; title: string; composer: string; license: string };

const manifest: Song[] = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));

// Same composer, same title: the case where a listener cannot tell two rows apart. Across
// composers a shared title is ordinary — every catalogue holds several Preludes — and the
// composer beside it settles which.
const groups = new Map<string, { composer: string; title: string; songs: Song[] }>();
for (const song of manifest) {
    const composer = canonicalComposer(song.composer);
    const key = `${composer} ${song.title}`;
    const group = groups.get(key) ?? { composer, title: song.title, songs: [] };
    group.songs.push(song);
    groups.set(key, group);
}

const CREDIT = /<credit-words[^>]*>([^<]*)<\/credit-words>/g;

function creditLines(song: Song): string[] {
    const xml = decompressMxl(
        new Uint8Array(readFileSync(`public/songs/${song.license.toLowerCase()}/${song.id}.mxl`)),
    );
    if (!xml) {
        return [];
    }
    return [...xml.matchAll(CREDIT)].map((match) => match[1]!.trim());
}

let shared = 0;
let named = 0;
let silent = 0;
const sorted = [...groups.values()].sort((a, b) =>
    `${a.composer} ${a.title}`.localeCompare(`${b.composer} ${b.title}`),
);
for (const { composer, title, songs } of sorted) {
    if (songs.length < 2) {
        continue;
    }
    shared += songs.length;
    console.log(`\n${composer} — "${title}"  (${songs.length} pieces)`);
    for (const song of songs) {
        let candidates: ReturnType<typeof movementCandidates> = [];
        try {
            candidates = movementCandidates(creditLines(song), title, song.composer);
        } catch (error) {
            const why = error instanceof Error ? error.message : String(error);
            console.log(`  ${song.id}  unreadable: ${why}`);
            continue;
        }
        if (candidates.length === 0) {
            silent += 1;
            console.log(`  ${song.id}  the score says nothing — needs somebody with the music`);
            continue;
        }
        named += 1;
        console.log(`  ${song.id}  ${candidates.map((candidate) => candidate.line).join("  ·  ")}`);
    }
}

console.log(
    `\n${shared} pieces share a title with another by the same composer. ` +
        `${named} print something that tells them apart; ${silent} print nothing.\n` +
        "Corrections go in dev/catalog-curation.json, one entry each, with a reason.",
);
