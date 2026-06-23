// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Exercise } from "./exercises";
import { pathSteps } from "./path";

const exercises = [{ id: "a" }, { id: "b" }, { id: "c" }] as Exercise[];

describe("pathSteps", () => {
    it("makes the first exercise current when nothing is done", () => {
        const steps = pathSteps(exercises, () => false);
        expect(steps.map((step) => step.status)).toEqual(["current", "locked", "locked"]);
    });

    it("advances the current step as exercises are completed", () => {
        const steps = pathSteps(exercises, (id) => id === "a");
        expect(steps.map((step) => step.status)).toEqual(["done", "current", "locked"]);
    });

    it("unlocks everything when all are done", () => {
        const steps = pathSteps(exercises, () => true);
        expect(steps.map((step) => step.status)).toEqual(["done", "done", "done"]);
    });

    it("keeps a later step locked even if a gap is somehow completed", () => {
        const steps = pathSteps(exercises, (id) => id === "c");
        expect(steps.map((step) => step.status)).toEqual(["current", "locked", "done"]);
    });
});
