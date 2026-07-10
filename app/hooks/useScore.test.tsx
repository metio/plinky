// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Score } from "../../core/score";
import { memoryStore } from "../adapters/memoryStore";
import type { ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { ServicesProvider } from "../contexts/services";
import { useScore } from "./useScore";

const scoreFor = (id: string): Score => ({
    id,
    title: `Title ${id}`,
    composer: "Anon",
    description: "",
    xml: "<x/>",
    tempo: 90,
    beatsPerBar: 4,
    bundled: false,
});

// Only `resolve` is exercised; the rest of each source is unused here.
const source = <T,>(resolve: (id: string) => Promise<Score | null | "unavailable">): T =>
    ({ resolve }) as unknown as T;

const wrap =
    (exercises: ExerciseSource, songs: SongSource) =>
    ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store: memoryStore(), exercises, songs }}>
            {children}
        </ServicesProvider>
    );

describe("useScore", () => {
    it("resolves a fetched score, having reported undefined while loading", async () => {
        const exercises = source<ExerciseSource>((id) => Promise.resolve(scoreFor(id)));
        const songs = source<SongSource>(() => Promise.resolve(null));
        const { result } = renderHook(() => useScore("étude"), { wrapper: wrap(exercises, songs) });
        expect(result.current).toBeUndefined();
        await waitFor(() => expect(result.current).toEqual(scoreFor("étude")));
    });

    it("discards a stale in-flight fetch when the id changes mid-flight", async () => {
        // "a" never resolves until we release it; "b" resolves immediately. The late "a"
        // must not overwrite "b".
        let releaseA: ((score: Score) => void) | undefined;
        const exercises = source<ExerciseSource>((id) =>
            id === "a"
                ? new Promise<Score>((resolve) => {
                      releaseA = resolve;
                  })
                : Promise.resolve(scoreFor(id)),
        );
        const songs = source<SongSource>(() => Promise.resolve(null));
        const { result, rerender } = renderHook(({ id }: { id: string }) => useScore(id), {
            wrapper: wrap(exercises, songs),
            initialProps: { id: "a" },
        });
        rerender({ id: "b" });
        await waitFor(() => expect(result.current).toEqual(scoreFor("b")));

        releaseA?.(scoreFor("a"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(result.current).toEqual(scoreFor("b"));
    });

    it("reports unavailable — not not-found — when a source cannot answer", async () => {
        const exercises = source<ExerciseSource>(() => Promise.resolve("unavailable"));
        const songs = source<SongSource>(() => Promise.resolve(null));
        const { result } = renderHook(() => useScore("real-but-offline"), {
            wrapper: wrap(exercises, songs),
        });
        await waitFor(() => expect(result.current).toBe("unavailable"));
    });

    it("reports unavailable when only the song source failed", async () => {
        const exercises = source<ExerciseSource>(() => Promise.resolve(null));
        const songs = source<SongSource>(() => Promise.resolve("unavailable"));
        const { result } = renderHook(() => useScore("real-but-offline"), {
            wrapper: wrap(exercises, songs),
        });
        await waitFor(() => expect(result.current).toBe("unavailable"));
    });

    it("lets a resolved score outrank another source's failure", async () => {
        const exercises = source<ExerciseSource>(() => Promise.resolve("unavailable"));
        const songs = source<SongSource>((id) => Promise.resolve(scoreFor(id)));
        const { result } = renderHook(() => useScore("song-1"), {
            wrapper: wrap(exercises, songs),
        });
        await waitFor(() => expect(result.current).toEqual(scoreFor("song-1")));
    });

    it("re-resolves when the attempt counter bumps, so a retry can succeed", async () => {
        let calls = 0;
        const exercises = source<ExerciseSource>((id) => {
            calls++;
            return Promise.resolve(calls === 1 ? "unavailable" : scoreFor(id));
        });
        const songs = source<SongSource>(() => Promise.resolve(null));
        const { result, rerender } = renderHook(
            ({ attempt }: { attempt: number }) => useScore("flaky", attempt),
            { wrapper: wrap(exercises, songs), initialProps: { attempt: 0 } },
        );
        await waitFor(() => expect(result.current).toBe("unavailable"));
        rerender({ attempt: 1 });
        await waitFor(() => expect(result.current).toEqual(scoreFor("flaky")));
    });
});
