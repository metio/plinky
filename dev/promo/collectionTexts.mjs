// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A YouTube playlist description per named work, written beside the clips it collects.
//
// The point of these is somebody who will never open Plinky. The app turns these
// collections into assignments a player works through in order, gentlest first; a playlist
// is the same order, the same pieces, for somebody who just wants to watch and learn. That
// only holds while both come from one list, which is why this reads the baked assignments
// rather than a second copy.
//
// Where a collection publishes short of the work it names, it says so. Eleven of the
// fifteen inventions is a useful playlist and a dishonest title, and the difference between
// those two is one sentence.

import { mkdir, writeFile } from "node:fs/promises";
import { collections, folderForCollection } from "./collections.mjs";
import { folderFor } from "./pieces.mjs";
import { FOLLOW_US } from "../../core/social.ts";
import { FINGER_LEGEND } from "./fingerLegend.mjs";

const OUT = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "promo";
const SITE = "https://plinky.fun";

function describe(set) {
    const short =
        set.pieces.length < set.held
            ? `${set.pieces.length} of the ${set.held} pieces the catalogue holds are here — the rest are under a licence that cannot travel with a video.`
            : null;
    return [
        `${set.name}, played in Plinky — the notes falling as they sound, and the keys lighting under them.`,
        "",
        // Order is the whole value of a collection: the app hands these to a player as an
        // assignment, gentlest first, and a playlist in the same order is the same lesson.
        "In playing order, gentlest first — the same order Plinky gives them to a player working through the set.",
        short,
        "",
        // Numbered, so the order survives being read down a screen, and named by the piece
        // rather than by the file, because that is what YouTube will be showing.
        ...set.pieces.map((piece, index) => `${index + 1}. ${piece.title}`),
        "",
        `Work through this set yourself: ${SITE}/en/assignments/`,
        "",
        "The colour of each note is the finger that plays it:",
        ...FINGER_LEGEND,
        "",
        "Plinky is a free piano practice app that runs in the browser — nothing to install, no account. It listens through a MIDI piano or your microphone and tells you how the run actually went, hand by hand.",
        "",
        SITE,
        "",
        "More Plinky:",
        ...FOLLOW_US.map((channel) => `${channel.label}: ${channel.href}`),
        "",
        "Every score is Creative Commons, so each piece here is one you are free to play, share and record.",
    ]
        .filter((line) => line !== null)
        .join("\n");
}

// Which clips make the playlist, in the order they go in.
//
// The description above says what the set is; this says what to upload into it. A
// collection's videos are scattered across the composer folders — a set of Bach inventions
// sits under Bach, beside pieces belonging to no set at all — so without this there is
// nothing on disk that says which of them belong together, and the order is the assignment's
// own, which no folder listing preserves.
function contents(set) {
    return [
        `${set.pieces.length} video${set.pieces.length === 1 ? "" : "s"}, in this order:`,
        "",
        ...set.pieces.map(
            (piece, index) =>
                `${String(index + 1).padStart(2, " ")}. promo/${folderFor(piece)}/youtube.mp4` +
                `\n    ${piece.title} — ${piece.composer}`,
        ),
    ].join("\n");
}

let written = 0;
for (const set of collections()) {
    const dir = `${OUT}/${folderForCollection(set)}`;
    await mkdir(dir, { recursive: true });
    // The words that go up with the playlist, exactly as a piece's own youtube.txt carries
    // the words for its clip.
    await writeFile(`${dir}/youtube.txt`, `${set.name} | Plinky\n\n${describe(set)}\n`);
    // And the assembly list, which is for whoever is doing the uploading rather than for
    // anybody watching. Kept apart from the description so neither has to be read around
    // the other, and so the description can be pasted into YouTube whole.
    await writeFile(`${dir}/videos.txt`, `${set.name}\n\n${contents(set)}\n`);
    written += 1;
}
console.log(`Wrote ${written} collection youtube.txt and videos.txt files under ${OUT}/.`);
