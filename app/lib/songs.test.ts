// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildExercise,
    exportAllPack,
    importSongsPack,
    loadCurriculums,
    loadUserSongs,
    parseBeatsPerBar,
    parseTempo,
    parseTitle,
    removeUserSong,
    resolveExercise,
    saveUserSong,
    slugify,
    submissionUrl,
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

    it("resolves a stored song by id", () => {
        saveUserSong(buildExercise(ABC, []));
        expect(resolveExercise("my-tune")?.title).toBe("My Tune");
        expect(resolveExercise("nope")).toBeUndefined();
    });
});

describe("song packs", () => {
    beforeEach(installLocalStorage);
    afterEach(() => localStorage.clear());

    const PACK = JSON.stringify({
        format: "plinky-songs",
        version: 1,
        curriculums: [{ id: "grade-1", name: "Grade 1" }],
        songs: [
            {
                id: "tune-a",
                title: "Tune A",
                abc: "X:1\nM:3/4\nL:1/4\nK:C\nC D E |",
                curriculums: ["grade-1"],
            },
            { id: "tune-b", title: "Tune B", abc: "X:1\nK:C\nG", tempo: 120, beatsPerBar: 2 },
        ],
    });

    it("imports songs and curriculums, filling missing tempo/meter from the ABC", () => {
        expect(importSongsPack(PACK)).toEqual({ imported: 2, curriculums: 1 });
        const songs = loadUserSongs();
        expect(songs.map((song) => song.id).sort()).toEqual(["tune-a", "tune-b"]);
        const a = songs.find((song) => song.id === "tune-a");
        expect(a?.beatsPerBar).toBe(3); // derived from M:3/4
        expect(a?.curriculums).toEqual(["grade-1"]);
        expect(songs.find((song) => song.id === "tune-b")?.tempo).toBe(120); // from the pack
        expect(loadCurriculums()).toEqual([{ id: "grade-1", name: "Grade 1" }]);
    });

    it("overwrites a song with the same id on re-import", () => {
        importSongsPack(PACK);
        importSongsPack(
            JSON.stringify({
                format: "plinky-songs",
                songs: [{ id: "tune-a", title: "Renamed", abc: "X:1\nK:C\nC" }],
            }),
        );
        expect(loadUserSongs()).toHaveLength(2);
        expect(loadUserSongs().find((song) => song.id === "tune-a")?.title).toBe("Renamed");
    });

    it("exports the whole library as a pack that imports back", () => {
        importSongsPack(PACK);
        expect(importSongsPack(exportAllPack())).toEqual({ imported: 2, curriculums: 1 });
    });

    it("surfaces a storage failure instead of reporting a false success", () => {
        const original = localStorage.setItem;
        localStorage.setItem = () => {
            throw new Error("quota exceeded");
        };
        expect(() => importSongsPack(PACK)).toThrow(/exceed this device's storage/);
        localStorage.setItem = original;
    });
});

describe("submissionUrl", () => {
    it("builds a prefilled issue-form link from a song", () => {
        const url = submissionUrl(buildExercise(ABC, []));
        expect(url).toContain("template=song-submission.yml");
        expect(url).toContain("song-title=My+Tune");
        expect(decodeURIComponent(url)).toContain("X:1");
    });

    it("links to the blank form when given no song", () => {
        expect(submissionUrl()).toBe(
            "https://github.com/metio/plinky/issues/new?template=song-submission.yml",
        );
    });

    it("prefills the license when the song has one", () => {
        const url = submissionUrl({ ...buildExercise(ABC, []), license: "CC-BY-4.0" });
        expect(url).toContain("license=CC-BY-4.0");
    });
});
