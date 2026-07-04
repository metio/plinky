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
    it("rebuilds a scale/arpeggio from the config in its manifest entry", async () => {
        // The id is a content fingerprint, so the app resolves it via the manifest, which
        // carries the config the generated exercise is rebuilt from.
        server.use(
            http.get("*/exercises/manifest.json", () =>
                HttpResponse.json([
                    {
                        id: "fingerprint123",
                        title: "C major arpeggio",
                        grade: 1,
                        cost: 1,
                        kind: "scale-arpeggio",
                        config: {
                            type: "major-arpeggio",
                            key: "c",
                            octaves: 2,
                            hands: "both",
                            inversion: 0,
                            interval: "single",
                        },
                        tempo: 90,
                        beatsPerBar: 4,
                    },
                ]),
            ),
        );
        const { resolveExercise } = await import("./exercises");
        const score = await resolveExercise("fingerprint123");
        expect(score?.xml).toContain("score-partwise");
        expect(score?.bundled).toBe(true);
    });

    it("returns null for an id that is not in the exercise manifest", async () => {
        server.use(http.get("*/exercises/manifest.json", () => HttpResponse.json([])));
        const { resolveExercise } = await import("./exercises");
        expect(await resolveExercise("not-an-exercise")).toBeNull();
    });
});
