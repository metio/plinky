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
    license: "CC-BY-4.0",
};

describe("score pack", () => {
    it("round-trips scores through serialize/parse", () => {
        const pack = parsePack(serializePack([score]));
        expect(pack.scores).toHaveLength(1);
        expect(pack.scores[0]).toMatchObject({ id: "scale", title: "Scale", tempo: 90 });
        expect(pack.scores[0]!.license).toBe("CC-BY-4.0");
    });

    it("rejects non-JSON and non-bundle documents", () => {
        expect(() => parsePack("not json")).toThrow(/valid JSON/);
        expect(() => parsePack(JSON.stringify({ format: "something-else" }))).toThrow(
            /not a Plinky score bundle/,
        );
    });

    it("rejects a pack with no usable scores", () => {
        expect(() => parsePack(JSON.stringify({ format: "plinky-scores", scores: [] }))).toThrow(
            /no scores|no valid scores/,
        );
        const malformed = { format: "plinky-scores", scores: [{ id: "x" }] };
        expect(() => parsePack(JSON.stringify(malformed))).toThrow(/no valid scores/);
    });

    it("drops a non-positive or non-finite tempo so it is re-derived on import", () => {
        const pack = parsePack(
            JSON.stringify({
                format: "plinky-scores",
                scores: [
                    { id: "a", title: "A", xml: "<x/>", tempo: 0, beatsPerBar: -4 },
                    { id: "b", title: "B", xml: "<x/>", tempo: 120, beatsPerBar: 3 },
                ],
            }),
        );
        expect(pack.scores[0]).not.toHaveProperty("tempo");
        expect(pack.scores[0]).not.toHaveProperty("beatsPerBar");
        expect(pack.scores[1]).toMatchObject({ tempo: 120, beatsPerBar: 3 });
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
