// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Bakes the catalogue's grade boundaries from the committed song costs — no PDMX
// corpus needed, so CI can run it. It re-derives the even octile cost boundaries over
// the shipped songs and applies them to:
//   • GRADE_THRESHOLDS.piece in app/lib/scoreDifficulty.ts (the in-app grade chip),
//   • each song's grade in public/songs/manifest.json,
//   • each study's grade in public/exercises/manifest.json (studies grade on the same
//     piece scale; scale/arpeggio tiles use their own fixed thresholds, untouched),
//   • public/songs/seed.json (three songs per grade).
//
// `npm run songs:bake` writes those; `npm run songs:bake -- --check` writes nothing and
// exits non-zero if any are stale — the CI guard so a catalogue change can't ship with
// grades that disagree with the boundaries. Run songs:bake after songs:import /
// songs:dedup, or whenever the catalogue changes.

import { readFile, writeFile } from "node:fs/promises";
import { gradeForCost, octileBoundaries } from "./grading.mts";

const MAX_GRADE = 8;
const SONGS = "public/songs";
const EXERCISES = "public/exercises";
const THRESHOLDS = "app/lib/scoreDifficulty.ts";
const PIECE_RE = /(piece:\s*\[)([^\]]*)(\])/;

const check = process.argv.includes("--check");

type Song = { id: string; cost: number; grade: number };
type Exercise = { id: string; cost: number; grade: number; kind: string };

function arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i]);
}

async function main() {
    const songs: Song[] = JSON.parse(await readFile(`${SONGS}/manifest.json`, "utf8"));
    const exercises: Exercise[] = JSON.parse(await readFile(`${EXERCISES}/manifest.json`, "utf8"));
    const seed: string[] = JSON.parse(await readFile(`${SONGS}/seed.json`, "utf8"));
    const source = await readFile(THRESHOLDS, "utf8");

    const boundaries = octileBoundaries(
        songs.map((song) => song.cost),
        MAX_GRADE,
    );

    // The freshly-graded catalogue these boundaries imply.
    const bakedSongs = songs.map((song) => ({ ...song, grade: gradeForCost(song.cost, boundaries) }));
    const bakedExercises = exercises.map((exercise) =>
        exercise.kind === "study"
            ? { ...exercise, grade: gradeForCost(exercise.cost, boundaries) }
            : exercise,
    );
    const bakedSeed: string[] = [];
    for (let g = 1; g <= MAX_GRADE; g++) {
        bakedSeed.push(
            ...bakedSongs
                .filter((song) => song.grade === g)
                .slice(0, 3)
                .map((song) => song.id),
        );
    }

    const currentPiece = (source.match(PIECE_RE)?.[2] ?? "")
        .split(",")
        .map((value) => Number(value.trim()));

    if (check) {
        const problems: string[] = [];
        if (!arraysEqual(currentPiece, boundaries)) {
            problems.push(
                `GRADE_THRESHOLDS.piece is [${currentPiece.join(", ")}] but the songs' octiles are [${boundaries.join(", ")}]`,
            );
        }
        const songDrift = songs.filter((song, i) => song.grade !== bakedSongs[i]!.grade).length;
        if (songDrift > 0) {
            problems.push(`${songDrift} song grade(s) disagree with the boundaries`);
        }
        const studyDrift = exercises.filter((ex, i) => ex.grade !== bakedExercises[i]!.grade).length;
        if (studyDrift > 0) {
            problems.push(`${studyDrift} study grade(s) disagree with the boundaries`);
        }
        if (seed.length !== bakedSeed.length || seed.some((id, i) => id !== bakedSeed[i])) {
            problems.push("seed.json is stale");
        }
        if (problems.length > 0) {
            console.error("Catalogue grades are not baked:");
            for (const problem of problems) {
                console.error(`  • ${problem}`);
            }
            console.error("\nRun `npm run songs:bake` to update, then commit the result.");
            process.exit(1);
        }
        console.log("Catalogue grades are baked and consistent.");
        return;
    }

    await writeFile(THRESHOLDS, source.replace(PIECE_RE, `$1${boundaries.join(", ")}$3`));
    await writeFile(`${SONGS}/manifest.json`, JSON.stringify(bakedSongs));
    await writeFile(`${EXERCISES}/manifest.json`, JSON.stringify(bakedExercises));
    await writeFile(`${SONGS}/seed.json`, JSON.stringify(bakedSeed));

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
