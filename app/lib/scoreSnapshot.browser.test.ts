// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Take } from "../../core/takes";
import { buildScoreSnapshot } from "./scoreSnapshot";

const take: Take = {
    id: "t1",
    createdAt: 0,
    letter: "A",
    complete: true,
    metrics: null,
    composition: {
        // Three steps: a chord, then two single notes.
        notes: [
            { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
            { pitch: 64, startMs: 0, durationMs: 400, velocity: 90 },
            { pitch: 62, startMs: 500, durationMs: 400, velocity: 90 },
            { pitch: 65, startMs: 1_000, durationMs: 400, velocity: 90 },
        ],
        tempo: 120,
        beatsPerBar: 4,
    },
};

describe("buildScoreSnapshot", () => {
    it("rasterizes the take's notation with one step box group per distinct onset", async () => {
        const snapshot = await buildScoreSnapshot(take);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.width).toBeGreaterThan(0);
        expect(snapshot!.height).toBeGreaterThan(0);
        // Three distinct onsets → three steps, the chord collapsing into one.
        expect(snapshot!.steps).toHaveLength(3);
        expect(snapshot!.steps[0]!.length).toBeGreaterThan(0);
        const box = snapshot!.steps[0]![0]!;
        expect(box.width).toBeGreaterThan(0);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        // The later step sits to the right of (or below) the first.
        const later = snapshot!.steps[2]![0]!;
        expect(later.x > box.x || later.y > box.y).toBe(true);
    });
});
