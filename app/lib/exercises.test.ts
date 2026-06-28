// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test re-imports the module so its manifest/Hanon caches start fresh.
beforeEach(() => vi.resetModules());
// restoreAllMocks does not undo stubGlobal, so the fetch stub would leak to whatever
// runs next in the worker; unstub it explicitly to keep the test isolated.
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("loadExerciseManifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        const { loadExerciseManifest } = await import("./exercises");
        expect(await loadExerciseManifest()).toEqual([]);
    });
});

describe("resolveExercise", () => {
    it("generates a parametric exercise with no network fetch", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { resolveExercise } = await import("./exercises");
        const score = await resolveExercise("arpeggio-c-major.2b");
        expect(score?.xml).toContain("score-partwise");
        expect(score?.bundled).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null for an id that is neither generated nor a study", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        const { resolveExercise } = await import("./exercises");
        expect(await resolveExercise("not-an-exercise")).toBeNull();
    });
});
