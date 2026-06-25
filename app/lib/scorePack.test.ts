// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type PackScore, parsePack, serializePack } from "./scorePack";

const score: PackScore = {
    id: "scale",
    title: "Scale",
    xml: "<score-partwise><part/></score-partwise>",
    tempo: 90,
    beatsPerBar: 4,
    curriculums: ["grade-1", "warmups"],
    license: "CC-BY-4.0",
};

describe("score pack", () => {
    it("round-trips scores and curriculums through serialize/parse", () => {
        const json = serializePack(
            [score],
            [{ id: "grade-1", name: "Grade 1", publisher: "School" }],
        );
        const pack = parsePack(json);
        expect(pack.scores).toHaveLength(1);
        expect(pack.scores[0]).toMatchObject({ id: "scale", title: "Scale", tempo: 90 });
        expect(pack.scores[0]!.curriculums).toEqual(["grade-1", "warmups"]);
        expect(pack.scores[0]!.license).toBe("CC-BY-4.0");
        expect(pack.curriculums).toEqual([{ id: "grade-1", name: "Grade 1", publisher: "School" }]);
    });

    it("carries several curriculums in one pack", () => {
        const json = serializePack(
            [score],
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
            /not a Plinky score pack/,
        );
    });

    it("rejects a pack with no usable scores", () => {
        expect(() => parsePack(JSON.stringify({ format: "plinky-scores", scores: [] }))).toThrow(
            /no scores|no valid scores/,
        );
        const malformed = { format: "plinky-scores", scores: [{ id: "x" }] };
        expect(() => parsePack(JSON.stringify(malformed))).toThrow(/no valid scores/);
    });

    it("drops malformed scores but keeps valid ones", () => {
        const pack = parsePack(
            JSON.stringify({
                format: "plinky-scores",
                scores: [{ id: "a", title: "A", xml: "<score-partwise/>" }, { id: "bad" }],
            }),
        );
        expect(pack.scores.map((entry) => entry.id)).toEqual(["a"]);
    });
});
