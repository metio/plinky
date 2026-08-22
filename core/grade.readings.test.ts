// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Grade, isOptionalReading, scoreReadings } from "./grade";

const grade = (over: Partial<Grade> = {}): Grade => ({
    accuracy: 90,
    timing: 80,
    flow: 70,
    dynamics: 60,
    expression: 50,
    score: 75,
    letter: "B",
    ...over,
});

describe("scoreReadings", () => {
    it("shows every reading the run earned, in one order", () => {
        expect(scoreReadings(grade())).toEqual([
            { id: "accuracy", value: 90 },
            { id: "timing", value: 80 },
            { id: "flow", value: 70 },
            { id: "dynamics", value: 60 },
            { id: "expression", value: 50 },
        ]);
    });

    it("leaves out a reading the score never asked for", () => {
        // Null is "not asked", never "scored zero": an unmarked piece has no dynamics to
        // follow, and a computer keyboard cannot report how hard a key was struck. Showing
        // 0% would read as a failure at something nobody attempted.
        const ids = scoreReadings(grade({ dynamics: null, expression: null })).map((r) => r.id);
        expect(ids).toEqual(["accuracy", "timing", "flow"]);
    });

    it("keeps the three every run earns even at zero", () => {
        // Zero is a real reading and must not be mistaken for an absent one.
        const readings = scoreReadings(grade({ accuracy: 0, timing: 0, flow: 0 }));
        expect(readings.filter((r) => r.value === 0)).toHaveLength(3);
    });

    it("marks exactly the two the score has to ask for as optional", () => {
        const optional = scoreReadings(grade())
            .map((r) => r.id)
            .filter(isOptionalReading);
        expect(optional).toEqual(["dynamics", "expression"]);
    });

    it("covers every numeric reading a Grade carries", () => {
        // The guard that makes this list worth having: a reading added to Grade and
        // forgotten here would silently vanish from BOTH places that show readings, and
        // each of them would still look internally consistent. Derived from the object, so
        // there is nothing to remember.
        const shown = new Set(scoreReadings(grade()).map((reading) => reading.id));
        const numeric = Object.entries(grade())
            .filter(([key, value]) => typeof value === "number" && key !== "score")
            .map(([key]) => key);
        expect([...numeric].sort()).toEqual([...shown].sort());
    });
});
