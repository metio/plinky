// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test-setup.node";

// Each test re-imports the module so its manifest/Hanon caches start fresh. The catalogue
// fetch is intercepted by the shared MSW server (test-setup.node), so a test overrides a
// route rather than stubbing the global fetch.
beforeEach(() => vi.resetModules());

describe("loadExerciseManifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        server.use(
            http.get("*/exercises/manifest.json", () => new HttpResponse(null, { status: 500 })),
        );
        const { loadExerciseManifest } = await import("./exercises");
        expect(await loadExerciseManifest()).toEqual([]);
    });
});

describe("resolveExercise", () => {
    it("generates a parametric exercise from its id alone", async () => {
        const { resolveExercise } = await import("./exercises");
        const score = await resolveExercise("arpeggio-c-major.2b");
        expect(score?.xml).toContain("score-partwise");
        expect(score?.bundled).toBe(true);
    });

    it("returns null for an id that is neither generated nor a study", async () => {
        const { resolveExercise } = await import("./exercises");
        expect(await resolveExercise("not-an-exercise")).toBeNull();
    });
});
