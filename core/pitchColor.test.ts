// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { BOOMWHACKER_SET } from "./pitchColor";

describe("BOOMWHACKER_SET", () => {
    it("carries eight entries — seven note names C–B plus a rest — in OSMD's order", () => {
        expect(BOOMWHACKER_SET).toHaveLength(8);
    });

    it("gives every note name its own hue", () => {
        const pitches = BOOMWHACKER_SET.slice(0, 7);
        expect(new Set(pitches).size).toBe(7);
    });

    it("is all hex colours", () => {
        for (const color of BOOMWHACKER_SET) {
            expect(color).toMatch(/^#[0-9a-f]{6}$/);
        }
    });
});
