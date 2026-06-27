// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { gzipSync, strToU8 } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test re-imports the module so its manifest/pack caches start fresh.
beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe("loadExerciseManifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        const { loadExerciseManifest } = await import("./exercises");
        expect(await loadExerciseManifest()).toEqual([]);
    });
});

describe("resolveExercise", () => {
    it("resolves an id to a playable score, decompressing the pack", async () => {
        const xml = '<score-partwise><part id="P1"></part></score-partwise>';
        const manifest = [
            { id: "scale-c-major", title: "C major scale", grade: 1, tempo: 90, beatsPerBar: 4 },
        ];
        const packGz = gzipSync(strToU8(JSON.stringify({ "scale-c-major": xml })));
        vi.stubGlobal(
            "fetch",
            vi.fn((url: string) =>
                Promise.resolve(
                    String(url).endsWith("manifest.json")
                        ? { ok: true, json: async () => manifest }
                        : { ok: true, arrayBuffer: async () => new Uint8Array(packGz).buffer },
                ),
            ),
        );
        const { resolveExercise } = await import("./exercises");
        const score = await resolveExercise("scale-c-major");
        expect(score?.title).toBe("C major scale");
        expect(score?.xml).toBe(xml);
        expect(score?.bundled).toBe(true);
    });

    it("returns null for an unknown id", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
        const { resolveExercise } = await import("./exercises");
        expect(await resolveExercise("nope")).toBeNull();
    });
});
