// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { catalogueAssignment, starterAssignment } from "./starterAssignments";

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
        const assignment = starterAssignment({
            ...base,
            demos: [{ id: "twinkle" }],
            exercises: [],
        });
        expect(assignment?.items).toEqual([{ id: "twinkle" }]);
    });

    it("returns null when the catalogue has nothing to offer", () => {
        expect(starterAssignment({ ...base, demos: [], exercises: [] })).toBeNull();
    });
});

describe("catalogueAssignment", () => {
    const set = {
        id: "bach-inventions",
        name: "Bach — The two-part inventions",
        items: ["a", "b", "c"],
    };

    it("keeps the catalogue's order, so a set is worked up through", () => {
        const assignment = catalogueAssignment({ set, known: () => true });
        expect(assignment?.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
        expect(assignment?.name).toBe("Bach — The two-part inventions");
        expect(assignment?.id).toBe("bach-inventions");
    });

    it("drops a piece the device cannot open rather than naming it", () => {
        const assignment = catalogueAssignment({ set, known: (id) => id !== "b" });
        expect(assignment?.items.map((item) => item.id)).toEqual(["a", "c"]);
    });

    it("offers nothing at all when none of the set resolves", () => {
        expect(catalogueAssignment({ set, known: () => false })).toBeNull();
    });
});
