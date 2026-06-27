// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { trackSteps } from "./tracks";

describe("trackSteps", () => {
    it("marks the first not-done step current, the rest upcoming", () => {
        const steps = trackSteps(["a", "b", "c"], () => false);
        expect(steps.map((step) => step.status)).toEqual(["current", "upcoming", "upcoming"]);
    });

    it("skips done steps and advances the current marker", () => {
        const steps = trackSteps(["a", "b", "c"], (id) => id === "a");
        expect(steps.map((step) => step.status)).toEqual(["done", "current", "upcoming"]);
    });

    it("marks everything done when the track is complete", () => {
        expect(trackSteps(["a"], () => true).map((step) => step.status)).toEqual(["done"]);
    });
});
