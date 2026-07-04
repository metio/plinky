// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { summarizeDynamics } from "./dynamics";

describe("summarizeDynamics", () => {
    it("reports perfect evenness for identical velocities", () => {
        const result = summarizeDynamics([80, 80, 80, 80]);
        expect(result.mean).toBe(80);
        expect(result.evenness).toBe(100);
        expect(result.label).toBe("Very even");
    });

    it("scores a spread of velocities as less even", () => {
        const result = summarizeDynamics([30, 120, 40, 110]);
        expect(result.evenness).toBeLessThan(75);
    });

    it("handles an empty passage", () => {
        expect(summarizeDynamics([])).toEqual({ mean: 0, evenness: 100, label: "—" });
    });

    it("labels the intermediate evenness bands", () => {
        expect(summarizeDynamics([80, 60]).label).toBe("Even");
        expect(summarizeDynamics([80, 40]).label).toBe("A little uneven");
        expect(summarizeDynamics([100, 20]).label).toBe("Uneven");
    });
});
