// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { nextIn } from "./cycle";
import { NOTE_HINT_CYCLE, NOTE_LABEL_CYCLE } from "./prefs";

describe("nextIn", () => {
    it("steps to the following setting", () => {
        expect(nextIn(["all", "c", "solfege", "off"], "c")).toBe("solfege");
    });

    it("wraps past the last back to the first", () => {
        expect(nextIn(["all", "c", "solfege", "off"], "off")).toBe("all");
    });

    it("starts from the beginning for a value the cycle does not hold", () => {
        // A setting read from a device that once had it, since removed: the control has
        // to keep working, and the first entry is the one that gives the most help.
        expect(nextIn(["all", "c", "off"], "solfege")).toBe("all");
    });

    it("has nowhere to go in an empty cycle", () => {
        expect(nextIn([], "off")).toBe("off");
    });

    it("walks every note-label and note-hint setting and comes back round", () => {
        // Tapping the control as many times as there are settings must return what it
        // started on, or a setting is unreachable by tapping.
        for (const cycle of [NOTE_LABEL_CYCLE, NOTE_HINT_CYCLE]) {
            const seen = new Set<string>();
            let value = cycle[0] as string;
            for (let step = 0; step < cycle.length; step++) {
                seen.add(value);
                value = nextIn(cycle as string[], value);
            }
            expect(seen.size).toBe(cycle.length);
            expect(value).toBe(cycle[0]);
        }
    });
});
