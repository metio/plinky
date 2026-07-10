// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    type Assignment,
    assignmentsReferencing,
    availableItemCount,
    decodeAssignmentLink,
    encodeAssignmentLink,
    makeAssignment,
    missingAssignmentIds,
    newAssignmentId,
    nextAssignmentStep,
    parseAssignment,
    pruneAssignment,
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

describe("missing pieces", () => {
    const known = new Set(["a", "b"]);
    const isKnown = (id: string) => known.has(id);
    const set = (items: string[]) =>
        makeAssignment({ id: "set", name: "Set", items: items.map((id) => ({ id })) });

    it("reports nothing missing for an empty item list", () => {
        expect(missingAssignmentIds([], isKnown)).toEqual([]);
        expect(availableItemCount([], isKnown)).toBe(0);
    });

    it("reports nothing missing when every id is known", () => {
        expect(missingAssignmentIds(set(["a", "b"]).items, isKnown)).toEqual([]);
        expect(availableItemCount(set(["a", "b"]).items, isKnown)).toBe(2);
    });

    it("reports each unknown id once, in first-seen order", () => {
        expect(missingAssignmentIds(set(["x", "a", "y", "x"]).items, isKnown)).toEqual(["x", "y"]);
        expect(availableItemCount(set(["x", "a", "y", "x"]).items, isKnown)).toBe(1);
    });

    it("reports every id when none are known", () => {
        expect(missingAssignmentIds(set(["x", "y"]).items, isKnown)).toEqual(["x", "y"]);
        expect(availableItemCount(set(["x", "y"]).items, isKnown)).toBe(0);
    });

    it("prunes exactly the unknown items and keeps tempo and note on survivors", () => {
        const assignment = makeAssignment({
            id: "set",
            name: "Set",
            items: [{ id: "a", tempo: 100, note: "slow" }, { id: "x" }, { id: "b" }],
        });
        const pruned = pruneAssignment(assignment, isKnown);
        expect(pruned.items).toEqual([{ id: "a", tempo: 100, note: "slow" }, { id: "b" }]);
        expect(pruned.name).toBe("Set");
        expect(pruned.id).toBe("set");
    });

    it("prunes to an empty item list when nothing is known", () => {
        expect(pruneAssignment(set(["x", "y"]), isKnown).items).toEqual([]);
    });

    it("counts the assignments referencing an id", () => {
        const assignments = [set(["a", "x"]), set(["b"]), set(["x", "x"])];
        expect(assignmentsReferencing(assignments, "x")).toBe(2);
        expect(assignmentsReferencing(assignments, "b")).toBe(1);
        expect(assignmentsReferencing(assignments, "nope")).toBe(0);
        expect(assignmentsReferencing([], "x")).toBe(0);
    });
});

describe("nextAssignmentStep with missing pieces", () => {
    const set = (id: string, items: string[]) =>
        makeAssignment({ id, name: id, items: items.map((piece) => ({ id: piece })) });

    it("skips a missing current step and points at the next playable one", () => {
        const missing = new Set(["dead"]);
        const next = nextAssignmentStep(
            [set("Set", ["dead", "a2", "a3"])],
            () => false,
            (id) => missing.has(id),
        );
        expect(next).toEqual({ name: "Set", step: 2, total: 3, scoreId: "a2" });
    });

    it("yields no pointer when every remaining step is missing", () => {
        const missing = new Set(["dead", "gone"]);
        expect(
            nextAssignmentStep([set("Set", ["dead", "gone"])], () => false, (id) =>
                missing.has(id),
            ),
        ).toBeNull();
    });

    it("falls through an all-missing assignment to the next one", () => {
        const missing = new Set(["dead"]);
        expect(
            nextAssignmentStep(
                [set("Broken", ["dead"]), set("Fine", ["b1"])],
                () => false,
                (id) => missing.has(id),
            ),
        ).toEqual({ name: "Fine", step: 1, total: 1, scoreId: "b1" });
    });

    it("treats nothing as missing by default", () => {
        expect(nextAssignmentStep([set("Set", ["a1"])], () => false)).toEqual({
            name: "Set",
            step: 1,
            total: 1,
            scoreId: "a1",
        });
    });
});
