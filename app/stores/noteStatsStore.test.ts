// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createNoteStatsStore } from "./noteStatsStore";

const run = [
    { pitches: [60], playedMs: 0, wrongBefore: 0 },
    { pitches: [62], playedMs: 600, wrongBefore: 1 },
];

describe("note stats store", () => {
    it("accumulates across runs rather than replacing", () => {
        const store = createNoteStatsStore(memoryStore());

        store.record(run);
        store.record(run);

        expect(store.load()["62"]).toEqual({ plays: 2, wrongs: 2, totalMs: 1200 });
    });

    it("reads an unplayed device as no stats", () => {
        expect(createNoteStatsStore(memoryStore()).load()).toEqual({});
    });

    it("reads a corrupt record as no stats rather than throwing", () => {
        const kv = memoryStore({ "plinky:notestats": "{{ broken" });

        expect(createNoteStatsStore(kv).load()).toEqual({});
    });

    it("reports a refused write", () => {
        const refusing = { ...memoryStore(), set: () => false };

        expect(createNoteStatsStore(refusing).record(run)).toBe(false);
    });

    it("notifies subscribers when a run lands", () => {
        const store = createNoteStatsStore(memoryStore());
        let notified = 0;
        store.subscribe(() => notified++);

        store.record(run);

        expect(notified).toBe(1);
    });
});
