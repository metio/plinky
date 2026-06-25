// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Song } from "./catalog";
import { groupByCurriculum } from "./curriculums";

function song(id: string, curriculums?: string[]): Song {
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
    it("groups songs under each curriculum they list", () => {
        const groups = groupByCurriculum(
            [song("a", ["g1"]), song("b", ["g1", "g2"]), song("c", ["g2"])],
            [
                { id: "g1", name: "Grade 1" },
                { id: "g2", name: "Grade 2" },
            ],
        );
        expect(groups).toHaveLength(2);
        expect(groups[0]!.curriculum?.id).toBe("g1");
        expect(groups[0]!.songs.map((entry) => entry.id)).toEqual(["a", "b"]);
        expect(groups[1]!.songs.map((entry) => entry.id)).toEqual(["b", "c"]);
    });

    it("collects songs in no known curriculum under a trailing null group", () => {
        const groups = groupByCurriculum(
            [song("a", ["g1"]), song("loose"), song("unknown", ["gone"])],
            [{ id: "g1", name: "Grade 1" }],
        );
        expect(groups[groups.length - 1]!.curriculum).toBeNull();
        expect(groups[groups.length - 1]!.songs.map((entry) => entry.id)).toEqual([
            "loose",
            "unknown",
        ]);
    });

    it("omits curriculums with no songs", () => {
        expect(groupByCurriculum([song("a", ["g1"])], [{ id: "empty", name: "Empty" }])).toEqual([
            { curriculum: null, songs: [song("a", ["g1"])] },
        ]);
    });
});
