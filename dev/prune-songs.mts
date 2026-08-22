// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Takes out of the catalogue what should never have been in it: transcriptions a machine
// produced rather than a person engraved, and second copies of a work already there.
//
// Both were found by ear first. A reader reported one Für Elise sounding broken around bars
// 24 and 28, and then noticed the library held three of them.
//
// **Machine transcriptions** are identified by tuplet ratios no engraver writes — twelve in
// the time of seven, twenty-four in the time of seventeen — which a quantiser produces to
// make a leftover gap add up. The reported file carries exactly one such ratio; the two
// copies the reader said sounded fine carry none. See core/transcriptionQuality.ts.
//
// **Duplicates** need all three of: the same composer, the same work (core/workTitle.ts,
// which holds a catalogue number apart from the name so "Für Elise" matches "Für Elise
// WoO 59" while "Nocturnes Op.27" never matches "Nocturnes Op.9"), and the same opening
// notes as SOUND (core/incipit.ts). All three, because any two of them are not enough:
// composer and title alone would have merged Bach's two different Menuets, Schubert's three
// different Ständchen and two numbers out of Die Zauberflöte — nine distinct works.
//
// The opening test is deliberately conservative and under-merges: two transcriptions that
// disagree about the first bar drift out of step and read as different pieces. That leaves a
// duplicate in the catalogue, which is a blemish; the opposite deletes a piece that is not a
// duplicate, which is a loss.
//
//   npm run songs:prune -- --check   what it would do, writing nothing (the CI gate)
//   npm run songs:prune              do it
//
// Removing songs shifts the grade boundaries, so run `npm run songs:bake` afterwards.

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { sameOpening } from "../core/incipit.ts";
import { decompressMxl } from "../core/musicxmlFile.ts";
import { canonicalComposer } from "../core/person.ts";
import { BEYOND_REPAIR, beyondThePiano } from "../core/pianoRange.ts";
import { quantiserMarks } from "../core/transcriptionQuality.ts";
import { sameWork, workTitle } from "../core/workTitle.ts";

const OUT = "public/songs";

type Song = { id: string; title: string; composer: string; incipit?: string; bars: number };

// Where each .mxl actually lives. The manifest names a licence and the files sit in a
// directory per licence — an earlier version of this deleted `public/songs/<id>.mxl`, which
// is nowhere, so every removal it made left its file orphaned on disk.
async function locate(): Promise<Map<string, string>> {
    const at = new Map<string, string>();
    for (const entry of await readdir(OUT, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === "index") {
            continue;
        }
        for (const file of await readdir(`${OUT}/${entry.name}`)) {
            if (file.endsWith(".mxl")) {
                at.set(file.replace(/\.mxl$/, ""), `${OUT}/${entry.name}/${file}`);
            }
        }
    }
    return at;
}

// Whether the score carries notes so far outside the keyboard that they are not a
// part of the music written in the wrong octave but something stapled onto it.
//
// One score in the catalogue puts F9 — seventeen semitones above the top of the piano, near
// the top of hearing — inside ordinary four-part chords, in the same voice as the music.
// There is nothing there to repair, where a bass written an octave low can simply be moved.
function phantomVoice(xml: string): boolean {
    for (const [, step, alterText, octave] of xml.matchAll(
        /<pitch>\s*<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(-?\d+)<\/octave>/g,
    )) {
        const midi =
            (Number(octave) + 1) * 12 +
            ([0, 2, 4, 5, 7, 9, 11][("CDEFGAB".indexOf(step as string))] as number) +
            Number(alterText ?? 0);
        if (beyondThePiano(midi) > BEYOND_REPAIR) {
            return true;
        }
    }
    return false;
}

async function main() {
    const check = process.argv.includes("--check");
    const manifest: Song[] = JSON.parse(await readFile(`${OUT}/manifest.json`, "utf8"));
    const at = await locate();

    const machine: Song[] = [];
    for (const song of manifest) {
        const path = at.get(song.id);
        if (!path) {
            continue;
        }
        const xml = await decompressMxl(new Uint8Array(await readFile(path)));
        if (xml && (quantiserMarks(xml) > 0 || phantomVoice(xml))) {
            machine.push(song);
        }
    }
    const machineIds = new Set(machine.map((song) => song.id));

    // Duplicates, over what survives the first cut — a machine transcription is not a
    // candidate to keep, and dropping it may leave a work with no duplicate at all.
    const left = manifest.filter((song) => !machineIds.has(song.id));
    const rows = left.map((song) => ({
        song,
        title: workTitle(song.title),
        composer: canonicalComposer(song.composer || ""),
    }));
    const extra: Song[] = [];
    const taken = new Set<string>();
    for (const row of rows) {
        if (taken.has(row.song.id)) {
            continue;
        }
        const group = rows.filter(
            (other) =>
                !taken.has(other.song.id) &&
                other.composer === row.composer &&
                sameWork(row.title, other.title) &&
                (other.song.id === row.song.id ||
                    sameOpening(row.song.incipit ?? "", other.song.incipit ?? "")),
        );
        for (const one of group) {
            taken.add(one.song.id);
        }
        if (group.length > 1) {
            // The fullest transcription is kept: of two readings of one work, the one that
            // stops early is the one that is missing something.
            const sorted = [...group].sort((one, other) => other.song.bars - one.song.bars);
            extra.push(...sorted.slice(1).map((one) => one.song));
        }
    }

    const goneIds = new Set([...machineIds, ...extra.map((song) => song.id)]);
    console.log(`beyond repair          : ${machine.length}`);
    console.log(`duplicate copies       : ${extra.length}`);
    console.log(`catalogue              : ${manifest.length} → ${manifest.length - goneIds.size}`);
    for (const song of extra) {
        console.log(`   duplicate: ${song.id}  ${song.title} (${song.composer})`);
    }

    if (check) {
        if (goneIds.size > 0) {
            console.error(`\n${goneIds.size} song(s) should not be in the catalogue.`);
            console.error("Run `npm run songs:prune`, then `npm run songs:bake`, and commit.");
            process.exit(1);
        }
        console.log("\nCatalogue is clean.");
        return;
    }

    await writeFile(
        `${OUT}/manifest.json`,
        JSON.stringify(manifest.filter((song) => !goneIds.has(song.id))),
    );
    for (const id of goneIds) {
        const path = at.get(id);
        if (path) {
            await rm(path, { force: true });
        }
    }
    console.log(`\nRemoved ${goneIds.size}. Now run \`npm run songs:bake\`.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
