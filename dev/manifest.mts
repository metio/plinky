// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two shipped manifests, read and written in one place. Every bake, import and promo
// script used to open public/songs/manifest.json itself under a row type of its own, so a
// field the manifest gained was typed as absent in the scripts written before it, and each
// silently dropped or ignored what its own type said was not there.

import { readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { ExerciseMeta, SongMeta } from "../core/catalogMeta.ts";

export const SONGS_DIR = "public/songs";
export const EXERCISES_DIR = "public/exercises";
export const SONGS_MANIFEST = `${SONGS_DIR}/manifest.json`;
export const EXERCISES_MANIFEST = `${EXERCISES_DIR}/manifest.json`;

// The manifests ship minified: they are fetched by every browsing visitor, and the
// whitespace of a pretty print is a third of the file.
const serialize = (rows: readonly unknown[]): string => JSON.stringify(rows);

function rowsOf<T>(text: string, path: string): T[] {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
        throw new Error(`${path}: not a list of rows`);
    }
    return parsed as T[];
}

export async function readSongs(path = SONGS_MANIFEST): Promise<SongMeta[]> {
    return rowsOf<SongMeta>(await readFile(path, "utf8"), path);
}

export function readSongsSync(path = SONGS_MANIFEST): SongMeta[] {
    return rowsOf<SongMeta>(readFileSync(path, "utf8"), path);
}

export async function writeSongs(rows: readonly SongMeta[], path = SONGS_MANIFEST): Promise<void> {
    await writeFile(path, serialize(rows));
}

export function writeSongsSync(rows: readonly SongMeta[], path = SONGS_MANIFEST): void {
    writeFileSync(path, serialize(rows));
}

export async function readExercises(path = EXERCISES_MANIFEST): Promise<ExerciseMeta[]> {
    return rowsOf<ExerciseMeta>(await readFile(path, "utf8"), path);
}

export async function writeExercises(
    rows: readonly ExerciseMeta[],
    path = EXERCISES_MANIFEST,
): Promise<void> {
    await writeFile(path, serialize(rows));
}

export function writeExercisesSync(rows: readonly ExerciseMeta[], path = EXERCISES_MANIFEST): void {
    writeFileSync(path, serialize(rows));
}
