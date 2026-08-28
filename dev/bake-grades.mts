// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Applies the catalogue's grade boundaries to the committed song costs — no PDMX corpus
// needed, so CI can run it. The boundaries themselves are the fixed, calibrated numbers in
// GRADE_THRESHOLDS.piece (core/scoreDifficulty.ts); this writes what they imply for:
//   • each song's grade in public/songs/manifest.json,
//   • each study's grade in public/exercises/manifest.json (studies grade on the same
//     piece scale; scale/arpeggio tiles use their own fixed thresholds, untouched).
//
// It does not compute the boundaries. They come from `npm run songs:calibrate`, which
// measures teaching repertoire whose grade is settled, and a person decides when to move
// them — moving them re-grades pieces players have already worked on.
//
// It also applies the hand-made metadata corrections (dev/curation.mts) and bakes the
// composer index (dev/bake-people.mts) from the same manifests, so every artefact derived
// from the shipped catalogue is regenerated and checked by one command and one CI gate
// rather than drifting apart behind separate ones. The corrections come first: the
// composer index is built from the credits, so it has to be built from the corrected ones.
//
// `npm run songs:bake` writes those; `npm run songs:bake -- --check` writes nothing and
// exits non-zero if any are stale — the CI guard so a catalogue change can't ship with
// grades that disagree with the boundaries. Run songs:bake after songs:import /
// songs:dedup, or whenever the catalogue changes.

import { readFile, writeFile } from "node:fs/promises";
import { bakePeopleIndex } from "./bake-people.mts";
import { bakeShards } from "./bake-shards.mts";
import { curate, loadCuration, unapplied } from "./curation.mts";
import { tidied, tidyCredit, tidyTitle } from "./titles.mts";
import { gradeForCost, pieceBoundaries } from "./grading.mts";

const MAX_GRADE = 8;
const SONGS = "public/songs";
const EXERCISES = "public/exercises";
const check = process.argv.includes("--check");

type Song = { id: string; cost: number; grade: number; title?: string; composer?: string };
type Exercise = {
    id: string;
    cost: number;
    grade: number;
    kind: string;
    title?: string;
    composer?: string;
};

async function main() {
    const songs: Song[] = JSON.parse(await readFile(`${SONGS}/manifest.json`, "utf8"));
    const exercises: Exercise[] = JSON.parse(await readFile(`${EXERCISES}/manifest.json`, "utf8"));

    // The hand-made corrections, applied before anything is derived from the credits.
    // A problem here stops both modes: a curation nobody can apply is one nobody can
    // evaluate either, and silently skipping it is how the file would rot.
    // The mechanical tidying first — entities, links, a missing capital — then the
    // hand-written corrections on top, so a curated title is always the last word.
    const tidy = <T extends { title?: string; composer?: string }>(entry: T): T => ({
        ...entry,
        ...(entry.title === undefined ? {} : { title: tidied(entry.title, tidyTitle) }),
        ...(entry.composer === undefined ? {} : { composer: tidied(entry.composer, tidyCredit) }),
    });

    const curation = await loadCuration();
    // Both manifests, because a study is as correctable as a song and the file does not
    // distinguish them — an id belongs to whichever catalogue holds it.
    const correctedSongs = curate(songs.map(tidy), curation.curations);
    const correctedExercises = curate(exercises.map(tidy), curation.curations);
    const curationProblems = [
        ...curation.problems,
        ...unapplied(
            curation.curations,
            new Set([...correctedSongs.applied, ...correctedExercises.applied]),
        ),
    ];
    if (curationProblems.length > 0) {
        console.error("Catalogue curation cannot be applied:");
        for (const problem of curationProblems) {
            console.error(`  • ${problem}`);
        }
        process.exit(1);
    }

    const boundaries = [...pieceBoundaries];

    // The freshly-graded catalogue these boundaries imply. Re-grading can move a piece
    // across a grade boundary, so re-establish the shipped order both manifests are
    // pinned to: songs easiest-first (grade follows cost), exercises by grade then cost.
    const bakedSongs = correctedSongs.pieces
        .map((song) => ({ ...song, grade: gradeForCost(song.cost, boundaries) }))
        .sort((a, b) => a.cost - b.cost);
    const bakedExercises = correctedExercises.pieces
        .map((exercise) =>
            exercise.kind === "study"
                ? { ...exercise, grade: gradeForCost(exercise.cost, boundaries) }
                : exercise,
        )
        .sort((a, b) => a.grade - b.grade || a.cost - b.cost);

    if (check) {
        const problems: string[] = [];
        // Compare the whole serialized result: this catches a stale grade AND a stale
        // order (re-grading can change which grade a piece sits in, hence its position).
        if (JSON.stringify(songs) !== JSON.stringify(bakedSongs)) {
            problems.push("public/songs/manifest.json is stale (grades, order or curation)");
        }
        if (JSON.stringify(exercises) !== JSON.stringify(bakedExercises)) {
            problems.push("public/exercises/manifest.json is stale (grades, order or curation)");
        }
        if (problems.length > 0) {
            console.error("Catalogue grades are not baked:");
            for (const problem of problems) {
                console.error(`  • ${problem}`);
            }
            console.error("\nRun `npm run songs:bake` to update, then commit the result.");
            process.exit(1);
        }
        if (!(await bakePeopleIndex(true))) {
            console.error("\nRun `npm run songs:bake` to update, then commit the result.");
            process.exit(1);
        }
        // Checked after the manifest itself, and against what is on disk rather than
        // against what was just computed: a slice is only right if it agrees with the
        // manifest a player's browse pages read.
        if (!(await bakeShards(true))) {
            console.error("Catalogue slices (public/songs/index) are stale.");
            console.error("\nRun `npm run songs:bake` to update, then commit the result.");
            process.exit(1);
        }
        console.log("Catalogue grades are baked and consistent.");
        return;
    }

    await writeFile(`${SONGS}/manifest.json`, JSON.stringify(bakedSongs));
    await writeFile(`${EXERCISES}/manifest.json`, JSON.stringify(bakedExercises));
    await bakePeopleIndex(false);
    // After the manifest is written, since the slices are cut from the file on disk.
    await bakeShards(false);

    const histogram = Array.from({ length: MAX_GRADE + 1 }, () => 0);
    for (const song of bakedSongs) {
        histogram[song.grade] = (histogram[song.grade] ?? 0) + 1;
    }
    console.log(`Baked piece boundaries: [${boundaries.join(", ")}]`);
    console.log(`Songs per grade: ${histogram.slice(1).join(" / ")}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
