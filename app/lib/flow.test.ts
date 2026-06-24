// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { computeFlow } from "./flow";

describe("computeFlow", () => {
    it("is 100 for an all-clean run", () => {
        expect(computeFlow([true, true, true, true])).toBe(100);
    });

    it("is 100 for an empty run", () => {
        expect(computeFlow([])).toBe(100);
    });

    it("docks one note per stumble rather than collapsing", () => {
        // One fumble in ten notes is still a smooth performance.
        expect(computeFlow([true, true, true, true, true, false, true, true, true, true])).toBe(90);
    });

    it("is 0 when every note was a struggle", () => {
        expect(computeFlow([false, false, false, false])).toBe(0);
    });
});
