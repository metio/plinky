// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moves a note that fell off the bottom of the keyboard back onto it.
//
// A harvested transcription occasionally writes a bass note an octave low — a notation
// program's default octave off by one. There is no key for it, so it is unreachable: a
// practice run waiting for that note waits forever, and the staff draws it on a pile of
// ledger lines below the instrument. Eight scores in the catalogue, between one and twelve
// notes each.
//
// Whole octaves only, which is the one move that keeps the note the note it was — shifting
// to the nearest playable key would change the harmony. A note further out than an octave is
// not a slip and is not repaired here; `songs:prune` removes those scores, because a voice
// three octaves above the chord it is attached to is not the music at all.
//
// The id does NOT change, and that is deliberate. It is a fingerprint of the notes, which is
// what makes it survive a re-slugging or a re-licensing — but it is also what a saved link,
// a mastery record and a curation entry are keyed by. Repairing a wrong note does not make
// the piece a different piece, and renumbering it would cost a reader their progress to buy
// nothing they would ever notice.
//
// The transform itself lives in ./repairPitch.mts, because the importer applies it on the
// way in — which is what stops a re-import quietly reintroducing every note this fixed.
// What remains here repairs scores already in the catalogue, for the ones imported before
// that was true.
//
//   npm run songs:repair -- --check   what it would move, writing nothing (the CI gate)
//   npm run songs:repair              do it
//
// Run `npm run songs:bake` afterwards: the opening mark is drawn from the notes.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { readZip, repaired, writeZip } from "./repairPitch.mts";

const OUT = "public/songs";

async function rewrite(path: string, change: (xml: string) => { xml: string; moved: number }) {
    const buffer = await readFile(path);
    const entries = readZip(buffer);
    let moved = 0;
    for (const entry of entries) {
        if (!/\.(xml|musicxml)$/.test(entry.name) || entry.name.includes("META-INF")) {
            continue;
        }
        const result = change(entry.data.toString("utf8"));
        if (result.moved > 0) {
            entry.data = Buffer.from(result.xml, "utf8");
            moved += result.moved;
        }
    }
    return { moved, write: async () => await writeFile(path, writeZip(entries)) };
}

async function main() {
    const check = process.argv.includes("--check");
    let scores = 0;
    let notes = 0;
    for (const dir of await readdir(OUT, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name === "index") {
            continue;
        }
        for (const file of await readdir(`${OUT}/${dir.name}`)) {
            if (!file.endsWith(".mxl")) {
                continue;
            }
            const path = `${OUT}/${dir.name}/${file}`;
            const { moved, write } = await rewrite(path, repaired);
            if (moved === 0) {
                continue;
            }
            scores += 1;
            notes += moved;
            console.log(`  ${moved.toString().padStart(3)} note(s)  ${file.replace(/\.mxl$/, "")}`);
            if (!check) {
                await write();
            }
        }
    }
    console.log(`\n${notes} note(s) off the keyboard, across ${scores} score(s)`);
    if (check && scores > 0) {
        console.error("Run `npm run songs:repair`, then `npm run songs:bake`, and commit.");
        process.exit(1);
    }
    if (!check && scores > 0) {
        console.log("Now run `npm run songs:bake` — the opening mark is drawn from the notes.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
