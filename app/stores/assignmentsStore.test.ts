// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { type Assignment, makeAssignment } from "../../core/assignment";
import { memoryStore } from "../adapters/memoryStore";
import { createAssignmentsStore } from "./assignmentsStore";

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

describe("assignmentsStore", () => {
    it("saves, lists and removes assignments", () => {
        const kv = memoryStore();
        const store = createAssignmentsStore(kv);
        const assignment = sample();
        expect(store.save(assignment)).toBe(true);
        expect(store.list().map((entry) => entry.id)).toEqual([assignment.id]);
        // A second instance over the same backing store reads the same truth.
        expect(createAssignmentsStore(kv).list()).toHaveLength(1);
        store.remove(assignment.id);
        expect(store.list()).toEqual([]);
    });

    it("upserts by id rather than appending a duplicate", () => {
        const store = createAssignmentsStore(memoryStore());
        const assignment = sample();
        store.save(assignment);
        store.save({ ...assignment, name: "Renamed" });
        const loaded = store.list();
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.name).toBe("Renamed");
    });

    it("keeps an edited assignment in its place rather than moving it to the end", () => {
        const store = createAssignmentsStore(memoryStore());
        const items = [{ id: "x" }];
        for (const name of ["First", "Second", "Third"]) {
            store.save(makeAssignment({ name, items }));
        }
        store.save(makeAssignment({ name: "First", description: "edited", items }));
        const loaded = store.list();
        expect(loaded.map((entry) => entry.name)).toEqual(["First", "Second", "Third"]);
        expect(loaded[0]?.description).toBe("edited");
    });

    it("drops malformed stored entries rather than failing the list", () => {
        const kv = memoryStore({
            "plinky:assignments": JSON.stringify([
                { id: "ok", name: "Good", items: [{ id: "x" }] },
                { id: "empty", name: "No items", items: [] },
                "junk",
            ]),
        });
        expect(
            createAssignmentsStore(kv)
                .list()
                .map((entry) => entry.id),
        ).toEqual(["ok"]);
    });

    it("reads corrupt storage as an empty list", () => {
        expect(
            createAssignmentsStore(memoryStore({ "plinky:assignments": "{oops" })).list(),
        ).toEqual([]);
    });

    it("notifies subscribers on save and remove", () => {
        const store = createAssignmentsStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        const assignment = sample();
        store.save(assignment);
        store.remove(assignment.id);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("keeps the assignment when its removal cannot be written", () => {
        const kv = memoryStore();
        createAssignmentsStore(kv).save(sample());
        const store = createAssignmentsStore({ ...kv, set: () => false });
        store.remove(sample().id);
        // Storage still holds it; the storage banner carries the failure signal.
        expect(createAssignmentsStore(kv).list()).toHaveLength(1);
    });

    it("reports a refused write and keeps the list unchanged", () => {
        const store = createAssignmentsStore({ ...memoryStore(), set: () => false });
        expect(store.save(sample())).toBe(false);
        expect(store.list()).toEqual([]);
    });
});
