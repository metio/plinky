// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { normalizeLifetime } from "./lifetime";

describe("normalizeLifetime", () => {
    it("returns a fresh empty Lifetime each call so a mutated result can't leak", () => {
        const a = normalizeLifetime(null);
        const b = normalizeLifetime(undefined);
        expect(a).toEqual({ days: [] });
        expect(a).not.toBe(b);
        // Mutating one result must not corrupt the empty value the next reader gets back.
        a.days.push({ date: "2026-07-06", skill: { accuracy: 1, timing: 1, flow: 1 } });
        expect(normalizeLifetime(null).days).toEqual([]);
    });

    it("drops malformed day entries rather than crashing the EMA blend later", () => {
        const parsed = {
            days: [
                { date: "2026-07-05", skill: { accuracy: 50, timing: 60, flow: 70 } },
                { date: 123, skill: { accuracy: 1, timing: 1, flow: 1 } }, // non-string date
                { date: "2026-07-06", skill: { accuracy: "x", timing: 1, flow: 1 } }, // bad skill
            ],
        };
        expect(normalizeLifetime(parsed).days).toEqual([
            { date: "2026-07-05", skill: { accuracy: 50, timing: 60, flow: 70 } },
        ]);
    });
});
