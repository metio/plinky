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

let written = 0;
for (const set of collections()) {
    const dir = `${OUT}/${folderForCollection(set)}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/playlist.txt`, `${set.name} | Plinky\n\n${describe(set)}\n`);
    written += 1;
}
console.log(`Wrote ${written} collection playlist.txt files under ${OUT}/.`);
