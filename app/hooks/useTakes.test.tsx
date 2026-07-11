// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Take } from "../../core/takes";
import { memoryStore } from "../adapters/memoryStore";
import { createTakesStore } from "../stores/takesStore";
import { useTakes } from "./useTakes";

const take = (id: string): Take => ({
    id,
    createdAt: 0,
    letter: "A",
    complete: true,
    metrics: null,
    composition: {
        notes: [{ pitch: 60, startMs: 0, durationMs: 300, velocity: 90 }],
        tempo: 100,
        beatsPerBar: 4,
    },
});

describe("useTakes", () => {
    it("loads the piece's takes and swaps lists when the piece changes", () => {
        const store = createTakesStore(memoryStore());
        store.save("song-a", take("t1"));
        store.save("song-b", take("t2"));
        const { result, rerender } = renderHook(({ id }) => useTakes(store, id), {
            initialProps: { id: "song-a" },
        });
        expect(result.current.takes.map((t) => t.id)).toEqual(["t1"]);
        rerender({ id: "song-b" });
        expect(result.current.takes.map((t) => t.id)).toEqual(["t2"]);
    });

    it("saves through the store, reports the verdict, and re-renders the stored list", () => {
        const store = createTakesStore(memoryStore());
        const { result } = renderHook(() => useTakes(store, "song"));
        let landed = false;
        act(() => {
            landed = result.current.save(take("t1"));
        });
        expect(landed).toBe(true);
        expect(result.current.takes.map((t) => t.id)).toEqual(["t1"]);
    });

    it("removes a take and shows what storage really holds", () => {
        const store = createTakesStore(memoryStore());
        store.save("song", take("t1"));
        store.save("song", take("t2"));
        const { result } = renderHook(() => useTakes(store, "song"));
        act(() => result.current.remove("t1"));
        expect(result.current.takes.map((t) => t.id)).toEqual(["t2"]);
    });
});
