// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { loadBundledScores } from "../lib/catalog";
import type { ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { useKnownPieces } from "./useKnownPieces";

// Only `manifest` is exercised; the rest of each source is unused here.
const source = <T,>(manifest: () => Promise<{ id: string; title: string }[] | null>): T =>
    ({ manifest }) as unknown as T;

const wrap =
    (exercises: ExerciseSource, songs: SongSource) =>
    ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store: memoryStore(), exercises, songs }}>
            {children}
        </ServicesProvider>
    );

describe("useKnownPieces", () => {
    it("stays indeterminate when a manifest fetch fails", async () => {
        // A failed fetch answers null — not an empty list — and must not read
        // as "every fetched piece is gone".
        const failing = source<ExerciseSource>(() => Promise.resolve(null));
        const songs = source<SongSource>(() => Promise.resolve([]));
        const { result } = renderHook(() => useKnownPieces(), {
            wrapper: wrap(failing, songs),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(result.current.ready).toBe(false);
        expect(result.current.isMissing("nothing-like-this")).toBe(false);
    });

    it("answers indeterminate — nothing missing — until every source has loaded", async () => {
        // A manifest that never resolves keeps the set unloaded for the whole test.
        const pending = source<ExerciseSource>(() => new Promise(() => {}));
        const songs = source<SongSource>(() => Promise.resolve([]));
        const { result } = renderHook(() => useKnownPieces(), {
            wrapper: wrap(pending, songs),
        });
        expect(result.current.ready).toBe(false);
        expect(result.current.isMissing("nothing-like-this")).toBe(false);
        expect(result.current.titleOf("nothing-like-this")).toBeNull();
    });

    it("marks unknown ids missing and titles known ones once both manifests arrive", async () => {
        const exercises = source<ExerciseSource>(() =>
            Promise.resolve([{ id: "ex-1", title: "Scale of C" }]),
        );
        const songs = source<SongSource>(() => Promise.resolve([{ id: "song-1", title: "Air" }]));
        const { result } = renderHook(() => useKnownPieces(), {
            wrapper: wrap(exercises, songs),
        });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.isMissing("ex-1")).toBe(false);
        expect(result.current.isMissing("song-1")).toBe(false);
        expect(result.current.isMissing("nothing-like-this")).toBe(true);
        expect(result.current.titleOf("song-1")).toBe("Air");
        // The local catalogue counts too: a bundled piece is never missing.
        const bundled = loadBundledScores()[0];
        expect(bundled).toBeDefined();
        expect(result.current.isMissing(bundled!.id)).toBe(false);
        expect(result.current.titleOf(bundled!.id)).toBe(bundled!.title);
    });
});
