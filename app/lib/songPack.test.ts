// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Exercise } from "./exercises";
import { parsePack, serializePack } from "./songPack";

const song: Exercise = {
    id: "scale",
    title: "Scale",
    description: "",
    abc: "X:1\nK:C\nC D E F |",
    tempo: 90,
    beatsPerBar: 4,
    curriculums: ["grade-1", "warmups"],
    license: "CC-BY-4.0",
};

describe("song pack", () => {
    it("round-trips songs and curriculums through serialize/parse", () => {
        const json = serializePack(
            [song],
            [{ id: "grade-1", name: "Grade 1", publisher: "School" }],
        );
        const pack = parsePack(json);
        expect(pack.songs).toHaveLength(1);
        expect(pack.songs[0]).toMatchObject({ id: "scale", title: "Scale", tempo: 90 });
        expect(pack.songs[0]!.curriculums).toEqual(["grade-1", "warmups"]);
        expect(pack.songs[0]!.license).toBe("CC-BY-4.0");
        expect(pack.curriculums).toEqual([{ id: "grade-1", name: "Grade 1", publisher: "School" }]);
    });

    it("carries several curriculums in one pack", () => {
        const json = serializePack(
            [song],
            [
                { id: "grade-1", name: "Grade 1" },
                { id: "grade-2", name: "Grade 2" },
            ],
        );
        expect(parsePack(json).curriculums.map((entry) => entry.id)).toEqual([
            "grade-1",
            "grade-2",
        ]);
    });

    it("rejects non-JSON and non-pack documents", () => {
        expect(() => parsePack("not json")).toThrow(/valid JSON/);
        expect(() => parsePack(JSON.stringify({ format: "something-else" }))).toThrow(
            /not a Plinky song pack/,
        );
    });

    it("rejects a pack with no usable songs", () => {
        expect(() => parsePack(JSON.stringify({ format: "plinky-songs", songs: [] }))).toThrow(
            /no songs|no valid songs/,
        );
        const malformed = { format: "plinky-songs", songs: [{ id: "x" }] };
        expect(() => parsePack(JSON.stringify(malformed))).toThrow(/no valid songs/);
    });

    it("drops malformed songs but keeps valid ones", () => {
        const pack = parsePack(
            JSON.stringify({
                format: "plinky-songs",
                songs: [{ id: "a", title: "A", abc: "X:1\nK:C\nC" }, { id: "bad" }],
            }),
        );
        expect(pack.songs.map((entry) => entry.id)).toEqual(["a"]);
    });
});
