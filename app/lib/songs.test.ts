// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildExercise,
    loadUserSongs,
    parseBeatsPerBar,
    parseTempo,
    parseTitle,
    removeUserSong,
    resolveExercise,
    saveUserSong,
    slugify,
    toAbcDocument,
} from "./songs";

const ABC = "X:1\nT:My Tune\nM:3/4\nL:1/4\nQ:1/4=132\nK:G\nG A B |";

function installLocalStorage(): void {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, String(value)),
        removeItem: (key) => void store.delete(key),
        clear: () => store.clear(),
        key: (index) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
    } satisfies Storage;
}

describe("ABC header parsing", () => {
    it("reads the title", () => {
        expect(parseTitle(ABC)).toBe("My Tune");
        expect(parseTitle("X:1\nK:C\nC")).toBe("");
    });

    it("reads the meter numerator, with common/cut time", () => {
        expect(parseBeatsPerBar(ABC)).toBe(3);
        expect(parseBeatsPerBar("M:4/4\nK:C")).toBe(4);
        expect(parseBeatsPerBar("M:C\nK:C")).toBe(4);
        expect(parseBeatsPerBar("M:C|\nK:C")).toBe(2);
        expect(parseBeatsPerBar("K:C")).toBe(4);
    });

    it("reads a bare or note-valued tempo, defaulting to 90", () => {
        expect(parseTempo(ABC)).toBe(132);
        expect(parseTempo("Q:120\nK:C")).toBe(120);
        expect(parseTempo("K:C")).toBe(90);
    });
});

describe("slugify", () => {
    it("makes a url-safe id", () => {
        expect(slugify("Ode to Joy!")).toBe("ode-to-joy");
    });

    it("falls back to 'song' when nothing remains", () => {
        expect(slugify("***")).toBe("song");
    });
});

describe("buildExercise", () => {
    it("derives fields from the ABC headers", () => {
        const exercise = buildExercise(ABC, []);
        expect(exercise).toMatchObject({
            id: "my-tune",
            title: "My Tune",
            tempo: 132,
            beatsPerBar: 3,
        });
    });

    it("disambiguates an id that is already taken", () => {
        expect(buildExercise(ABC, ["my-tune"]).id).toBe("my-tune-2");
        expect(buildExercise(ABC, ["my-tune", "my-tune-2"]).id).toBe("my-tune-3");
    });
});

describe("toAbcDocument", () => {
    it("inserts a tempo header for export when the ABC has none", () => {
        const exercise = buildExercise("X:1\nT:Plain\nM:4/4\nL:1/4\nK:C\nC D E F |", []);
        expect(toAbcDocument(exercise)).toContain("Q:1/4=90\nK:C");
    });

    it("leaves an existing tempo header untouched", () => {
        expect(toAbcDocument(buildExercise(ABC, []))).toBe(ABC.trim());
    });
});

describe("persistence", () => {
    beforeEach(installLocalStorage);
    afterEach(() => localStorage.clear());

    it("round-trips and removes user songs", () => {
        const exercise = buildExercise(ABC, []);
        saveUserSong(exercise);
        expect(loadUserSongs()).toEqual([exercise]);
        removeUserSong(exercise.id);
        expect(loadUserSongs()).toEqual([]);
    });

    it("replaces a song with the same id rather than duplicating it", () => {
        saveUserSong(buildExercise(ABC, []));
        saveUserSong({ ...buildExercise(ABC, []), title: "Renamed" });
        expect(loadUserSongs()).toHaveLength(1);
        expect(loadUserSongs()[0].title).toBe("Renamed");
    });

    it("resolves built-in and imported songs, preferring built-ins", () => {
        expect(resolveExercise("c-major-scale")?.title).toBe("C major scale");
        saveUserSong(buildExercise(ABC, []));
        expect(resolveExercise("my-tune")?.title).toBe("My Tune");
        expect(resolveExercise("nope")).toBeUndefined();
    });
});
