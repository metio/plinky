// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    type Assignment,
    decodeAssignmentLink,
    encodeAssignmentLink,
    makeAssignment,
    newAssignmentId,
    nextAssignmentStep,
    parseAssignment,
    serializeAssignment,
} from "./assignment";

const sample = (): Assignment =>
    makeAssignment({
        name: "Week 1",
        description: "Warm up, then the piece.",
        items: [
            { id: "scale-c-major", tempo: 100 },
            { id: "minuet-in-g", note: "mind the repeat" },
            { id: "arpeggio-g-major" },
        ],
    });

describe("makeAssignment", () => {
    it("drops malformed items and keeps the valid ones in order", () => {
        const assignment = makeAssignment({
            name: "Mixed",
            items: [{ id: "a" }, { nope: true }, "x", { id: "b", tempo: 120 }],
        });
        expect(assignment.items.map((item) => item.id)).toEqual(["a", "b"]);
    });

    it("rejects out-of-range tempos but keeps the item", () => {
        const assignment = makeAssignment({ name: "T", items: [{ id: "a", tempo: 5000 }] });
        expect(assignment.items[0]).toEqual({ id: "a" });
    });

    it("falls back to a name and id when none is usable", () => {
        const assignment = makeAssignment({ name: "   ", items: [{ id: "a" }] });
        expect(assignment.name).toBe("Untitled");
        expect(assignment.id).toBe("untitled");
    });
});

describe("newAssignmentId", () => {
    it("derives a slug and uniquifies against taken ids", () => {
        expect(newAssignmentId("Week 1", [])).toBe("week-1");
        expect(newAssignmentId("Week 1", ["week-1"])).toBe("week-1-2");
        expect(newAssignmentId("Week 1", ["week-1", "week-1-2"])).toBe("week-1-3");
    });
});

describe("serialize / parse", () => {
    it("round-trips an assignment through JSON", () => {
        const assignment = sample();
        expect(parseAssignment(serializeAssignment(assignment))).toEqual(assignment);
    });

    it("rejects a document that isn't a Plinky assignment", () => {
        expect(() => parseAssignment(JSON.stringify({ format: "something-else" }))).toThrow(
            /not a Plinky assignment/,
        );
    });

    it("rejects an assignment with no valid items", () => {
        expect(() =>
            parseAssignment(
                JSON.stringify({
                    format: "plinky-assignment",
                    version: 1,
                    name: "Empty",
                    items: [{}],
                }),
            ),
        ).toThrow(/no valid items/);
    });

    it("rejects text that isn't JSON", () => {
        expect(() => parseAssignment("nonsense")).toThrow(/not valid JSON/);
    });
});

describe("share link", () => {
    it("round-trips name, description, tempos and notes", () => {
        const assignment = sample();
        const decoded = decodeAssignmentLink(encodeAssignmentLink(assignment));
        expect(decoded?.name).toBe("Week 1");
        expect(decoded?.description).toBe("Warm up, then the piece.");
        expect(decoded?.items).toEqual(assignment.items);
    });

    it("produces a URL-safe token with no padding", () => {
        const code = encodeAssignmentLink(sample());
        expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("returns null for a corrupt or empty code", () => {
        expect(decodeAssignmentLink("")).toBeNull();
        expect(decodeAssignmentLink("!!!not-base64!!!")).toBeNull();
    });
});

describe("nextAssignmentStep", () => {
    const set = (id: string, items: string[]) =>
        makeAssignment({ id, name: id, items: items.map((piece) => ({ id: piece })) });

    it("points at the first unlearned step of the first open assignment", () => {
        const learned = new Set(["a1", "a2"]);
        const next = nextAssignmentStep(
            [set("First steps", ["a1", "a2", "a3", "a4"])],
            (id) => learned.has(id),
        );
        expect(next).toEqual({ name: "First steps", step: 3, total: 4, scoreId: "a3" });
    });

    it("skips finished assignments and reports null when everything is done", () => {
        const learned = new Set(["a1", "b1"]);
        expect(
            nextAssignmentStep(
                [set("done", ["a1"]), set("open", ["b1", "b2"])],
                (id) => learned.has(id),
            ),
        ).toEqual({ name: "open", step: 2, total: 2, scoreId: "b2" });
        expect(nextAssignmentStep([set("done", ["a1"])], (id) => learned.has(id))).toBeNull();
        expect(nextAssignmentStep([], () => false)).toBeNull();
    });
});
