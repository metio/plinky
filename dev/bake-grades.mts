// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Applies the catalogue's grade boundaries — no PDMX corpus needed, so CI can run it. The
// boundaries are the fixed, calibrated numbers in GRADE_THRESHOLDS (core/scoreDifficulty.ts);
// this writes what they imply for each song's grade in public/songs/manifest.json and each
// exercise's in public/exercises/manifest.json.
//
// It does not compute the boundaries. They come from `npm run songs:calibrate`, and a person
// decides when to move them — moving them re-grades pieces players have already worked on.
//
// It does compute cost, because cost is whatever the difficulty model currently says, and a
// change to that model silently invalidates every stored number. Every exercise is remeasured
// outright: a scale or arpeggio tile is regenerated from the config on its row and a study
// from the .mxl beside it, so neither needs the corpus that `npm run exercises` does. Songs
// are too many to remeasure in a gate, so a spread of them is probed and a drift stops the
// bake with the command that fixes it. Grades baked from costs the model no longer produces
// are wrong in a way nothing downstream can see, which is how forty-two studies once landed
// in grade 1 together.
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
import { crowdedGrade, staleSong } from "./bakeChecks.mts";
import { exerciseMeasure } from "./exerciseCosts.mts";
import type { ExerciseConfig } from "../core/exerciseGen.ts";
import { gradeForCost, pieceBoundaries } from "./grading.mts";

const MAX_GRADE = 8;
const SONGS = "public/songs";
const EXERCISES = "public/exercises";
const check = process.argv.includes("--check");

type Song = {
    id: string;
    cost: number;
    grade: number;
    license?: string;
    title?: string;
    composer?: string;
    incipit?: string;
};

type Exercise = {
    id: string;
    cost: number;
    grade: number;
    kind: string;
    title?: string;
    composer?: string;
    incipit?: string;
    // A scale or arpeggio tile carries the config it is generated from, which is what
    // lets its notation — and so everything derived from it — be reproduced without the
    // PDMX corpus.
    config?: ExerciseConfig;
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
    // Exercise cost is remeasured here rather than carried over. Every change to the
    // difficulty model invalidates every stored cost, and `npm run exercises` — the only
    // thing that used to refresh these — needs the PDMX corpus and has no reason to be run
    // after a change to core/scoreDifficulty.ts. Both kinds are reproducible from what the
    // repository ships, so measuring them here leaves nothing to remember and lets the
    // check below fail on a manifest measured under a model that has since moved.
    const bakedExercises = correctedExercises.pieces
        .map((exercise) => {
            const measured = exerciseMeasure(exercise);
            if (measured === null) {
                return exercise;
            }
            // Drop what was there before spreading, so an incipit the notation no longer
            // yields is removed rather than kept from a previous bake.
            const { incipit: _previous, ...rest } = exercise;
            return { ...rest, ...measured };
        })
        .sort((a, b) => a.grade - b.grade || a.cost - b.cost);

    // Before anything is derived from them, check the stored values still come from the
    // models that are in the tree. Grades baked from costs measured under a previous model
    // are wrong in a way nothing downstream can see, and a stale incipit draws the wrong
    // opening under the right title.
    const drifted = await staleSong(songs);
    if (drifted !== null) {
        console.error("The song manifest was not derived from the current models:");
        console.error(`  • ${drifted}`);
        console.error("\nThen bake again.");
        process.exit(1);
    }

    // The scale and arpeggio boundaries have no outside repertoire to anchor them: the
    // tiles are the curriculum, and the boundaries exist to spread them. So the check is
    // that they still do. A change to the difficulty model moves every tile cost, and the
    // boundaries — fixed numbers in core — do not follow, which shows up as the whole
    // curriculum piling into one grade.
    const lopsided = crowdedGrade(bakedExercises);
    if (lopsided !== null) {
        console.error("The exercise grade boundaries no longer match the difficulty model:");
        console.error(`  • ${lopsided}`);
        console.error(
            "\nRun `npm run songs:calibrate` for the boundaries the tiles imply, put them in",
        );
        console.error("GRADE_THRESHOLDS (core/scoreDifficulty.ts), then bake again.");
        process.exit(1);
    }

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
