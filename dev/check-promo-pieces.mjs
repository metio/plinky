// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every piece the promo list names must still be one the catalogue can render.
//
// The list is hand-curated — "recognisable in three seconds" is a judgement no filter
// makes — but three facts about each entry are not judgements at all, and all three had
// quietly stopped being true:
//
//   • It resolves. Ids are content fingerprints, so a re-import that changes the notes
//     changes the id. One entry had been pointing at nothing for some time.
//   • It is solo piano. Three entries were a singer over a piano part — Ave Maria among
//     them — which a piano channel should not be leading with.
//   • It is CC0. The catalogue's CC-BY and CC-BY-SA scores carry obligations a social
//     post strips: the credit is burnt into every frame, but share-alike travels with the
//     video and a feed is the worst place to argue about it.
//
// A whole-catalogue render said each of these once, into a log nobody reads, and carried
// on. This turns them into a red gate. Run: `npm run promo:check`.

import { readFile } from "node:fs/promises";
import { PIECES } from "./promo/pieces.mjs";

const MANIFEST = "public/songs/manifest.json";

export function promoProblems(pieces, songs) {
    const byId = new Map(songs.map((song) => [song.id, song]));
    const problems = [];
    for (const piece of pieces) {
        const song = byId.get(piece.id);
        const named = `${piece.title} (${piece.composer})`;
        if (!song) {
            problems.push(`${named}: ${piece.id} is not in the catalogue`);
            continue;
        }
        if (song.scoreKind !== "solo-piano") {
            problems.push(`${named}: is ${song.scoreKind ?? "of unrecorded kind"}, not solo piano`);
        }
        if (song.license !== "CC0-1.0") {
            problems.push(`${named}: is ${song.license}, and only CC0 may be posted`);
        }
    }
    return problems;
}

const songs = JSON.parse(await readFile(MANIFEST, "utf8"));
const problems = promoProblems(PIECES, songs);
if (problems.length > 0) {
    console.error("The promo list names pieces the catalogue cannot render:");
    for (const problem of problems) {
        console.error(`  • ${problem}`);
    }
    console.error(
        "\nEither the score was re-imported under a new fingerprint, or it is no longer\n" +
            "something to post. Fix dev/promo/pieces.mjs.",
    );
    process.exit(1);
}
console.log(`Promo list: ${PIECES.length} pieces, all solo piano, CC0, and in the catalogue.`);
