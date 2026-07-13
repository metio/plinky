// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Take } from "../../core/takes";
import { takeFileStem } from "./takeFile";

function take(overrides: Partial<Take>): Take {
    return {
        id: "t1",
        createdAt: 0,
        letter: "S",
        complete: true,
        metrics: null,
        composition: { notes: [], tempo: 120, beatsPerBar: 4 },
        ...overrides,
    };
}

describe("takeFileStem", () => {
    it("names a take by slugged title, grade, and saved date/time", () => {
        // The exact stamp is local-time-dependent, so pin the stable parts and the shape.
        const stem = takeFileStem("Twinkle, Twinkle Little Star", take({ letter: "S" }));
        expect(stem).toMatch(/^twinkle-twinkle-little-star-S-\d{4}-\d{2}-\d{2}-\d{4}$/);
    });

    it("labels an ungraded take 'take' in place of a letter", () => {
        const stem = takeFileStem("Menuet", take({ letter: "" }));
        expect(stem).toMatch(/^menuet-take-\d{4}-\d{2}-\d{2}-\d{4}$/);
    });

    it("distinguishes two takes saved a minute apart", () => {
        const a = takeFileStem("Menuet", take({ createdAt: 0 }));
        const b = takeFileStem("Menuet", take({ createdAt: 60_000 }));
        expect(a).not.toBe(b);
    });
});
