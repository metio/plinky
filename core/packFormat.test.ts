// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { parseAssignment } from "./assignment";
import { isPackFormat } from "./packFormat";
import { parseProgressPack, PROGRESS_FORMAT } from "./progressPack";
import { parsePack } from "./scorePack";

describe("naming a document's format", () => {
    it("takes the current name", () => {
        expect(isPackFormat("klimpi-progress", "klimpi-progress")).toBe(true);
    });

    it("takes the name the same document carried under the old brand", () => {
        expect(isPackFormat("plinky-progress", "klimpi-progress")).toBe(true);
        expect(isPackFormat("plinky-scores", "klimpi-scores")).toBe(true);
        expect(isPackFormat("plinky-assignment", "klimpi-assignment")).toBe(true);
    });

    it("does not let one document pass as another, under either brand", () => {
        expect(isPackFormat("klimpi-scores", "klimpi-progress")).toBe(false);
        expect(isPackFormat("plinky-scores", "klimpi-progress")).toBe(false);
        expect(isPackFormat("plinky-progress", "klimpi-scores")).toBe(false);
    });

    it("refuses anything that is not a format name at all", () => {
        for (const tag of [undefined, null, "", "klimpi", 1, {}, ["klimpi-progress"]]) {
            expect(isPackFormat(tag, "klimpi-progress")).toBe(false);
        }
    });
});

// The reason the readers take the old name: a file saved before the rebrand is still a
// backup of somebody's practice, and the document inside it never changed.
describe("a document saved under the old brand", () => {
    it("restores as a progress bundle", () => {
        const saved = JSON.stringify({
            format: "plinky-progress",
            version: 1,
            savedAt: "2026-10-30T09:00:00.000Z",
            entries: { "mastery:twinkle": '{"bestScore":91}' },
        });

        const result = parseProgressPack(saved);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.pack.entries["mastery:twinkle"]).toBe('{"bestScore":91}');
            // Read back under the current name, so saving it again writes the new tag.
            expect(result.pack.format).toBe(PROGRESS_FORMAT);
        }
    });

    it("imports as a score library", () => {
        const saved = JSON.stringify({
            format: "plinky-scores",
            version: 1,
            scores: [{ id: "abc", title: "Twinkle", xml: "<score-partwise/>" }],
        });

        const pack = parsePack(saved);

        expect(pack.scores).toHaveLength(1);
        expect(pack.scores[0]?.title).toBe("Twinkle");
    });

    it("opens as an assignment", () => {
        const saved = JSON.stringify({
            format: "plinky-assignment",
            version: 1,
            name: "Week one",
            items: [{ id: "abc" }],
        });

        const assignment = parseAssignment(saved);

        expect(assignment.name).toBe("Week one");
        expect(assignment.items).toHaveLength(1);
    });

    it("is still refused when it names a format nothing here writes", () => {
        expect(() =>
            parseAssignment(JSON.stringify({ format: "plinky-recipes", items: [] })),
        ).toThrow(/not a Klimpi assignment/);
    });
});
