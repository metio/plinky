// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
        expect(store.remove(assignment.id)).toBe(true);
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
        // The refused write is reported so a caller can react, and storage still holds
        // the assignment — the storage banner carries the aggregate failure signal.
        expect(store.remove(sample().id)).toBe(false);
        expect(createAssignmentsStore(kv).list()).toHaveLength(1);
    });

    it("reports a refused write and keeps the list unchanged", () => {
        const store = createAssignmentsStore({ ...memoryStore(), set: () => false });
        expect(store.save(sample())).toBe(false);
        expect(store.list()).toEqual([]);
    });
});

describe("what survives being stored", () => {
    // Every optional field, populated. The reparse rebuilds each entry through
    // makeAssignment, so a field it forgets to pass is defaulted away — and because
    // the next save writes the rebuilt object back, the loss is permanent after one
    // read-then-write rather than merely invisible. A due date was lost exactly this
    // way. Adding a field to Assignment without carrying it through fails here.
    const populated = (): Assignment =>
        makeAssignment({
            id: "week-1",
            origin: "origin-1",
            name: "Week 1",
            description: "Warm up, then the piece.",
            dueOn: "2026-09-14",
            items: [
                { id: "scale-c-major", tempo: 100 },
                { id: "minuet-in-g", note: "mind the repeat" },
            ],
        });

    it("round-trips every field of an assignment", () => {
        const store = createAssignmentsStore(memoryStore());
        const assignment = populated();
        store.save(assignment);
        expect(store.list()[0]).toEqual(assignment);
    });

    it("still holds every field after a read, an edit and another read", () => {
        // The read-then-write path: whatever the first list() dropped, the save that
        // follows it commits.
        const kv = memoryStore();
        const store = createAssignmentsStore(kv);
        store.save(populated());
        const read = store.list()[0];
        expect(read).toBeDefined();
        store.save({ ...(read as Assignment), name: "Week 1, revised" });
        const again = store.list()[0];
        expect(again?.dueOn).toBe("2026-09-14");
        expect(again?.origin).toBe("origin-1");
        expect(again?.description).toBe("Warm up, then the piece.");
    });

    it("keeps a set with no optional fields free of them", () => {
        const store = createAssignmentsStore(memoryStore());
        const bare = makeAssignment({ id: "bare", name: "Bare", items: [{ id: "a" }] });
        store.save(bare);
        expect(store.list()[0]).toEqual(bare);
    });
});
