// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Score } from "./catalog";
import { groupByCurriculum } from "./curriculums";

function score(id: string, curriculums?: string[]): Score {
    return {
        id,
        title: id,
        composer: "",
        description: "",
        xml: "<score-partwise/>",
        tempo: 90,
        beatsPerBar: 4,
        bundled: false,
        ...(curriculums ? { curriculums } : {}),
    };
}

describe("groupByCurriculum", () => {
    it("groups scores under each curriculum they list", () => {
        const groups = groupByCurriculum(
            [score("a", ["g1"]), score("b", ["g1", "g2"]), score("c", ["g2"])],
            [
                { id: "g1", name: "Grade 1" },
                { id: "g2", name: "Grade 2" },
            ],
        );
        expect(groups).toHaveLength(2);
        expect(groups[0]!.curriculum?.id).toBe("g1");
        expect(groups[0]!.scores.map((entry) => entry.id)).toEqual(["a", "b"]);
        expect(groups[1]!.scores.map((entry) => entry.id)).toEqual(["b", "c"]);
    });

    it("collects scores in no known curriculum under a trailing null group", () => {
        const groups = groupByCurriculum(
            [score("a", ["g1"]), score("loose"), score("unknown", ["gone"])],
            [{ id: "g1", name: "Grade 1" }],
        );
        expect(groups[groups.length - 1]!.curriculum).toBeNull();
        expect(groups[groups.length - 1]!.scores.map((entry) => entry.id)).toEqual([
            "loose",
            "unknown",
        ]);
    });

    it("omits curriculums with no scores", () => {
        expect(groupByCurriculum([score("a", ["g1"])], [{ id: "empty", name: "Empty" }])).toEqual([
            { curriculum: null, scores: [score("a", ["g1"])] },
        ]);
    });
});
