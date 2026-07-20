// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type AidPrefs, READING_LEVELS, levelAids, levelOf } from "./readingLevel";

describe("levelAids", () => {
    it("gives a new starter every aid and a sight-reader none", () => {
        expect(levelAids("starter")).toEqual({
            noteLabels: "all",
            noteHints: "always",
            colorNotes: true,
            forgiving: true,
            highway: true,
        });
        expect(levelAids("sightReader")).toEqual({
            noteLabels: "off",
            noteHints: "never",
            colorNotes: false,
            forgiving: false,
            highway: false,
        });
    });

    it("sheds help monotonically down the ladder", () => {
        const helpCount = (aids: AidPrefs) =>
            (aids.noteLabels !== "off" ? 1 : 0) +
            (aids.noteHints !== "never" ? 1 : 0) +
            (aids.colorNotes ? 1 : 0) +
            (aids.forgiving ? 1 : 0) +
            (aids.highway ? 1 : 0);
        const counts = READING_LEVELS.map((level) => helpCount(levelAids(level)));
        for (let i = 1; i < counts.length; i++) {
            expect(counts[i]!).toBeLessThan(counts[i - 1]!);
        }
    });
});

describe("levelOf", () => {
    it("round-trips: the aids of a level derive back to that level", () => {
        for (const level of READING_LEVELS) {
            expect(levelOf(levelAids(level))).toBe(level);
        }
    });

    it("reads a hand-tuned mix as custom", () => {
        // Starter's aids but with the highway turned off — matches no level.
        expect(levelOf({ ...levelAids("starter"), highway: false })).toBe("custom");
    });

    it("ignores non-aid prefs when matching", () => {
        // Extra fields on the object (as a full Prefs would carry) don't matter.
        const withExtras = { ...levelAids("confident"), sound: false, volume: 10 } as AidPrefs;
        expect(levelOf(withExtras)).toBe("confident");
    });
});
