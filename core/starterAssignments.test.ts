// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { starterAssignment } from "./starterAssignments";

const base = { id: "starter", name: "First steps", description: "A first set." };

describe("starterAssignment", () => {
    it("orders the demo tunes first, then the three easiest grade-1 studies", () => {
        const assignment = starterAssignment({
            ...base,
            demos: [{ id: "twinkle" }, { id: "ode" }],
            exercises: [
                { id: "hard-study", grade: 1, cost: 0.9, kind: "study" },
                { id: "easy-study", grade: 1, cost: 0.1, kind: "study" },
                { id: "scale", grade: 1, cost: 0.05, kind: "scale-arpeggio" },
                { id: "grade2-study", grade: 2, cost: 0.1, kind: "study" },
                { id: "mid-study", grade: 1, cost: 0.5, kind: "study" },
                { id: "extra-study", grade: 1, cost: 0.95, kind: "study" },
            ],
        });
        expect(assignment?.items.map((item) => item.id)).toEqual([
            "twinkle",
            "ode",
            "easy-study",
            "mid-study",
            "hard-study",
        ]);
        expect(assignment?.name).toBe("First steps");
    });

    it("still builds from the demos alone when no study qualifies", () => {
        const assignment = starterAssignment({ ...base, demos: [{ id: "twinkle" }], exercises: [] });
        expect(assignment?.items).toEqual([{ id: "twinkle" }]);
    });

    it("returns null when the catalogue has nothing to offer", () => {
        expect(starterAssignment({ ...base, demos: [], exercises: [] })).toBeNull();
    });
});
