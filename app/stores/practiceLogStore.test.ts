// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { type PracticeLog, type PracticeSession, SESSION_GAP_MS } from "../../core/practiceSession";
import { memoryStore } from "../adapters/memoryStore";
import { createPracticeLogStore } from "./practiceLogStore";

const MINUTE = 60_000;
// Local-time noon so the derived day key is 2026-06-23 in any runner zone.
const NOON = new Date(2026, 5, 23, 12, 0).getTime();

// The log's first session, or a failure — indexing is checked in this project, and a
// test that quietly skipped its assertions on an empty log would pass for the wrong reason.
function only(log: PracticeLog): PracticeSession {
    const [session] = log;
    if (!session) {
        throw new Error("expected the log to hold a session");
    }
    return session;
}

describe("practiceLogStore", () => {
    it("folds runs into one sitting and notifies each time it changes", () => {
        const store = createPracticeLogStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.record({ at: NOON, activeMs: 5 * MINUTE, notes: 40, pieceId: "alpha" });
        store.record({ at: NOON + MINUTE, activeMs: 2 * MINUTE, notes: 10, pieceId: "beta" });
        expect(store.load()).toHaveLength(1);
        expect(only(store.load()).activeMs).toBe(7 * MINUTE);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("opens a second sitting once the gap is exceeded", () => {
        const store = createPracticeLogStore(memoryStore());
        store.record({ at: NOON, activeMs: MINUTE, notes: 5 });
        store.record({ at: NOON + SESSION_GAP_MS + MINUTE, activeMs: MINUTE, notes: 5 });
        expect(store.load()).toHaveLength(2);
    });

    it("stays silent and still reports success when a run records nothing", () => {
        const store = createPracticeLogStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.record({ at: NOON, activeMs: 0, notes: 0 })).toBe(true);
        expect(store.load()).toEqual([]);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("adds, annotates and removes a hand-logged sitting", () => {
        const store = createPracticeLogStore(memoryStore());
        expect(store.addManual({ date: "2026-06-23", minutes: 45, label: "scales" })).toBe(true);
        const session = only(store.load());
        expect(session.manual).toBe(true);
        expect(session.label).toBe("scales");

        store.setMood(session.start, "good");
        expect(only(store.load()).mood).toBe("good");

        store.remove(session.start);
        expect(store.load()).toEqual([]);
    });

    it("survives a round trip through storage", () => {
        const kv = memoryStore();
        createPracticeLogStore(kv).record({ at: NOON, activeMs: 3 * MINUTE, notes: 12 });
        expect(only(createPracticeLogStore(kv).load()).activeMs).toBe(3 * MINUTE);
    });

    it("reports a refused write so a caller with its own indicator can react", () => {
        const kv = memoryStore();
        vi.spyOn(kv, "set").mockReturnValue(false);
        const store = createPracticeLogStore(kv);
        expect(store.addManual({ date: "2026-06-23", minutes: 10 })).toBe(false);
    });
});

describe("a manual entry the log will not take", () => {
    // The store's boolean is what a "saved" indicator gates on, and a rejected entry
    // leaves the log untouched — which the no-op rule reads as success. So the panel said
    // saved for something thrown away.
    it("reports failure rather than success", () => {
        const store = createPracticeLogStore(memoryStore());
        expect(store.addManual({ date: "not-a-day", minutes: 30 })).toBe(false);
        expect(store.addManual({ date: "2026-08-20", minutes: 0 })).toBe(false);
        expect(store.addManual({ date: "2026-08-20", minutes: 99_999 })).toBe(false);
        expect(store.load()).toEqual([]);
    });

    it("reports failure for one the cap slices straight back off", () => {
        // The log keeps the newest 2000. An entry dated before the oldest of those is
        // added, sorted, and cut — the array changes, so a naive check calls it saved,
        // and the player is told a row landed that nobody will ever see again.
        const store = createPracticeLogStore(memoryStore());
        const full = Array.from({ length: 2000 }, (_, index) => ({
            start: Date.UTC(2026, 0, 1) + index * 86_400_000,
            end: Date.UTC(2026, 0, 1) + index * 86_400_000 + 60_000,
            activeMs: 60_000,
            notes: 0,
            pieces: [],
            manual: true,
            mood: null,
            label: "",
        }));
        store.save(full);
        expect(store.addManual({ date: "2020-01-01", minutes: 30 })).toBe(false);
        expect(store.load()).toHaveLength(2000);
    });

    it("still reports success for one it takes", () => {
        const store = createPracticeLogStore(memoryStore());
        expect(store.addManual({ date: "2026-08-20", minutes: 30 })).toBe(true);
        expect(store.load()).toHaveLength(1);
    });
});
