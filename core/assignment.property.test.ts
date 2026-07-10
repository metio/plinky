// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type AssignmentItem,
    availableItemCount,
    makeAssignment,
    missingAssignmentIds,
    pruneAssignment,
} from "./assignment";

// Items over a tiny id alphabet, so known/unknown overlaps and duplicate ids
// occur often, together with a known-set drawn from the same alphabet.
const ids: fc.Arbitrary<string> = fc.constantFrom("a", "b", "c", "d", "e");
const items = fc.array(
    ids.map((id): AssignmentItem => ({ id })),
    { maxLength: 30 },
);
const knownSet = fc.uniqueArray(ids).map((known) => new Set(known));

const assignmentOf = (list: AssignmentItem[]) =>
    makeAssignment({ id: "set", name: "Set", items: list });

describe("assignment missing-piece properties", () => {
    it("prunes exactly the unknown ids", () => {
        fc.assert(
            fc.property(items, knownSet, (list, known) => {
                const pruned = pruneAssignment(assignmentOf(list), (id) => known.has(id));
                expect(pruned.items.every((item) => known.has(item.id))).toBe(true);
                expect(pruned.items.length).toBe(
                    list.filter((item) => known.has(item.id)).length,
                );
            }),
        );
    });

    it("is idempotent: pruning twice equals pruning once", () => {
        fc.assert(
            fc.property(items, knownSet, (list, known) => {
                const isKnown = (id: string) => known.has(id);
                const once = pruneAssignment(assignmentOf(list), isKnown);
                expect(pruneAssignment(once, isKnown)).toEqual(once);
            }),
        );
    });

    it("preserves the relative order of the surviving items", () => {
        fc.assert(
            fc.property(items, knownSet, (list, known) => {
                const pruned = pruneAssignment(assignmentOf(list), (id) => known.has(id));
                const survivors = assignmentOf(list).items.filter((item) => known.has(item.id));
                expect(pruned.items).toEqual(survivors);
            }),
        );
    });

    it("splits every item into available or missing, with missing ids distinct", () => {
        fc.assert(
            fc.property(items, knownSet, (list, known) => {
                const isKnown = (id: string) => known.has(id);
                const clean = assignmentOf(list).items;
                const missing = missingAssignmentIds(clean, isKnown);
                expect(new Set(missing).size).toBe(missing.length);
                expect(missing.every((id) => !known.has(id))).toBe(true);
                const available = availableItemCount(clean, isKnown);
                const missingItems = clean.filter((item) => !known.has(item.id)).length;
                expect(available + missingItems).toBe(clean.length);
            }),
        );
    });

    it("finds nothing missing exactly when the assignment survives pruning intact", () => {
        fc.assert(
            fc.property(items, knownSet, (list, known) => {
                const isKnown = (id: string) => known.has(id);
                const assignment = assignmentOf(list);
                const untouched =
                    pruneAssignment(assignment, isKnown).items.length ===
                    assignment.items.length;
                expect(missingAssignmentIds(assignment.items, isKnown).length === 0).toBe(
                    untouched,
                );
            }),
        );
    });
});
