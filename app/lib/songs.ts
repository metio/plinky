// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Exercise } from "./exercises";
import { type Curriculum, parsePack, serializePack } from "./songPack";

// Songs live in localStorage as ABC-derived Exercises (seeded from the registry
// on first run, or imported). ABC is the interchange format, so a song
// round-trips through any ABC-aware tool. Validation that the notes are actually
// playable lives in the import UI, which renders the ABC and runs buildSteps.

const STORAGE_KEY = "plinky:songs";
const CURRICULUMS_KEY = "plinky:curriculums";

export function parseTitle(abc: string): string {
    return abc.match(/^T:\s*(.+)$/m)?.[1].trim() ?? "";
}

// The meter numerator is how many beats fill a bar. `C` is common (4/4) time and
// `C|` is cut (2/2) time.
export function parseBeatsPerBar(abc: string): number {
    const meter = abc.match(/^M:\s*(.+)$/m)?.[1].trim();
    if (!meter) {
        return 4;
    }
    if (meter.startsWith("C|")) {
        return 2;
    }
    if (meter.startsWith("C")) {
        return 4;
    }
    return Number(meter.match(/^(\d+)\s*\//)?.[1] ?? 4);
}

// `Q:` may be a bare number or a note-value tempo such as `1/4=120`.
export function parseTempo(abc: string): number {
    const match = abc.match(/^Q:\s*(?:\d+\/\d+\s*=\s*)?(\d+)/m);
    return match ? Number(match[1]) : 90;
}

export function slugify(title: string): string {
    return (
        title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "song"
    );
}

// Derive an Exercise from ABC, giving it an id unique among the ones passed.
export function buildExercise(abc: string, existingIds: string[]): Exercise {
    const title = parseTitle(abc) || "Imported song";
    const base = slugify(title);
    const taken = new Set(existingIds);
    let id = base;
    for (let n = 2; taken.has(id); n++) {
        id = `${base}-${n}`;
    }
    return {
        id,
        title,
        description: "Imported song",
        abc: abc.trim(),
        tempo: parseTempo(abc),
        beatsPerBar: parseBeatsPerBar(abc),
    };
}

// Embed the exercise tempo as a `Q:` header so an export round-trips back at the
// same speed when the ABC carries its tempo outside the notation.
export function toAbcDocument(exercise: Exercise): string {
    if (/^Q:/m.test(exercise.abc)) {
        return exercise.abc;
    }
    return exercise.abc.replace(/^(K:.*)$/m, `Q:1/4=${exercise.tempo}\n$1`);
}

export function loadUserSongs(): Exercise[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveUserSong(exercise: Exercise): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    const songs = loadUserSongs().filter((song) => song.id !== exercise.id);
    songs.push(exercise);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch {
        // Storage can fail in private mode or over quota; an import is a
        // convenience, so a failed write is not surfaced.
    }
}

export function removeUserSong(id: string): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    const songs = loadUserSongs().filter((song) => song.id !== id);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch {
        // See saveUserSong.
    }
}

// The locally stored song with this id, if any — the trainers' single source.
export function resolveExercise(id: string | undefined): Exercise | undefined {
    return loadUserSongs().find((song) => song.id === id);
}

// The curriculums a user has acquired (their human-readable names), accumulated
// from imported packs so songs can be grouped and a backup round-trips the names.
export function loadCurriculums(): Curriculum[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(CURRICULUMS_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveCurriculums(curriculums: Curriculum[]): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(CURRICULUMS_KEY, JSON.stringify(curriculums));
    } catch {
        // See saveUserSong.
    }
}

// A backup of the whole local library as a Plinky song pack.
export function exportAllPack(): string {
    return serializePack(loadUserSongs(), loadCurriculums());
}

// Import a song pack: merge its curriculums and songs into local storage,
// overwriting any song or curriculum with the same id (so re-importing an
// updated curriculum refreshes it). Tempo and meter fall back to the ABC when a
// hand-authored pack omits them. Throws if the pack is not valid.
export function importSongsPack(json: string): { imported: number; curriculums: number } {
    const pack = parsePack(json);

    const curriculums = new Map(loadCurriculums().map((entry) => [entry.id, entry]));
    for (const entry of pack.curriculums) {
        curriculums.set(entry.id, entry);
    }
    saveCurriculums([...curriculums.values()]);

    const songs = new Map(loadUserSongs().map((song) => [song.id, song]));
    for (const song of pack.songs) {
        songs.set(song.id, {
            id: song.id,
            title: song.title,
            description: song.description ?? "Imported song",
            abc: song.abc.trim(),
            tempo: song.tempo ?? parseTempo(song.abc),
            beatsPerBar: song.beatsPerBar ?? parseBeatsPerBar(song.abc),
            ...(song.curriculums ? { curriculums: song.curriculums } : {}),
        });
    }
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...songs.values()]));
        } catch {
            // Unlike a single convenience save, a mass-import must not claim
            // success when nothing was stored (e.g. the songs exceed the quota).
            throw new Error("Could not save the songs — they may exceed this device's storage.");
        }
    }
    return { imported: pack.songs.length, curriculums: pack.curriculums.length };
}
