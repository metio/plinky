// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import type { Composition } from "../../core/composition";
import { MAX_TAKES_PER_SONG, type Take } from "../../core/takes";
import type { KeyValueStore } from "../ports/keyValueStore";
import { memoryStore } from "../adapters/memoryStore";
import { createTakesStore } from "./takesStore";

const comp = (starts: number[]): Composition => ({
    notes: starts.map((startMs, i) => ({ pitch: 60 + i, startMs, durationMs: 200, velocity: 90 })),
    tempo: 120,
    beatsPerBar: 4,
});

const take = (id: string, overrides: Partial<Take> = {}): Take => ({
    id,
    createdAt: Number(id),
    letter: "B",
    complete: true,
    metrics: null,
    composition: comp([0, 500, 1000]),
    ...overrides,
});

const refusing = (kv: KeyValueStore): KeyValueStore => ({ ...kv, set: () => false });

describe("takesStore", () => {
    it("round-trips a take through the share codec", () => {
        const takes = createTakesStore(memoryStore());
        takes.save("song", take("1"));
        const loaded = takes.list("song");
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.letter).toBe("B");
        expect(loaded[0]?.composition.notes.map((n) => n.startMs)).toEqual([0, 500, 1000]);
    });

    it("keeps the newest first and caps the list, dropping the oldest", () => {
        const takes = createTakesStore(memoryStore());
        for (let i = 1; i <= MAX_TAKES_PER_SONG + 2; i++) {
            takes.save("song", take(String(i)));
        }
        const loaded = takes.list("song");
        expect(loaded).toHaveLength(MAX_TAKES_PER_SONG);
        expect(loaded[0]?.id).toBe(String(MAX_TAKES_PER_SONG + 2));
        expect(loaded.map((t) => t.id)).not.toContain("1");
    });

    it("keeps each song's takes separate", () => {
        const takes = createTakesStore(memoryStore());
        takes.save("a", take("1"));
        takes.save("b", take("2"));
        expect(takes.list("a").map((t) => t.id)).toEqual(["1"]);
        expect(takes.list("b").map((t) => t.id)).toEqual(["2"]);
    });

    it("removes a take by id and reports the landed write", () => {
        const takes = createTakesStore(memoryStore());
        takes.save("song", take("1"));
        takes.save("song", take("2"));
        const result = takes.remove("song", "1");
        expect(result.stored).toBe(true);
        expect(result.takes.map((t) => t.id)).toEqual(["2"]);
        expect(takes.list("song").map((t) => t.id)).toEqual(["2"]);
    });

    it("hands back the stored list, not the optimistic one, when a save is refused", () => {
        const kv = memoryStore();
        createTakesStore(kv).save("song", take("1"));
        const takes = createTakesStore(refusing(kv));
        const result = takes.save("song", take("2"));
        expect(result.stored).toBe(false);
        // The refused take must not show up as saved — reloading would lose it.
        expect(result.takes.map((t) => t.id)).toEqual(["1"]);
    });

    it("keeps a take in the list when its removal cannot be written", () => {
        const kv = memoryStore();
        createTakesStore(kv).save("song", take("1"));
        const result = createTakesStore(refusing(kv)).remove("song", "1");
        expect(result.stored).toBe(false);
        expect(result.takes.map((t) => t.id)).toEqual(["1"]);
    });

    it("skips corrupt stored entries rather than failing the list", () => {
        const kv = memoryStore({
            "plinky:takes:song": JSON.stringify([
                { id: "ok", createdAt: 1, letter: "A", complete: true, code: "x" },
                "junk",
            ]),
        });
        // The valid entry has an unreadable code, so it's skipped; no throw.
        expect(createTakesStore(kv).list("song")).toEqual([]);
    });

    it("notifies subscribers on save and remove", () => {
        const takes = createTakesStore(memoryStore());
        const onChange = vi.fn();
        takes.subscribe(onChange);
        takes.save("song", take("1"));
        takes.remove("song", "1");
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});
