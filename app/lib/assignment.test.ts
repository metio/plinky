// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
    type Assignment,
    assignmentToTrack,
    decodeAssignmentLink,
    encodeAssignmentLink,
    loadAssignments,
    makeAssignment,
    newAssignmentId,
    parseAssignment,
    removeAssignment,
    saveAssignment,
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

afterEach(() => {
    localStorage.clear();
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

describe("storage", () => {
    it("saves, loads and removes assignments", () => {
        const assignment = sample();
        expect(saveAssignment(assignment)).toBe(true);
        expect(loadAssignments().map((entry) => entry.id)).toEqual([assignment.id]);
        removeAssignment(assignment.id);
        expect(loadAssignments()).toEqual([]);
    });

    it("upserts by id rather than appending a duplicate", () => {
        const assignment = sample();
        saveAssignment(assignment);
        saveAssignment({ ...assignment, name: "Renamed" });
        const loaded = loadAssignments();
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.name).toBe("Renamed");
    });
});

describe("assignmentToTrack", () => {
    it("maps to an ordered, namespaced track", () => {
        const track = assignmentToTrack(sample());
        expect(track.id).toBe("assignment:week-1");
        expect(track.kind).toBe("progression");
        expect(track.scoreIds).toEqual(["scale-c-major", "minuet-in-g", "arpeggio-g-major"]);
    });
});
