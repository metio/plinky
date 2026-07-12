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

describe("buildScoreSnapshot with the original score", () => {
    it("prefers the piece's own notation when the take lines up, falls back when not", async () => {
        // The original piece: four single notes → four steps.
        const xml = (await import("../../core/composition")).toMusicXml({
            notes: [60, 62, 64, 65].map((pitch, index) => ({
                pitch,
                startMs: index * 500,
                durationMs: 400,
                velocity: 90,
            })),
            tempo: 120,
            beatsPerBar: 4,
        });
        // The take covers three of them — a partial run still tints the original.
        const fits = await buildScoreSnapshot(take, { xml, hand: "both" });
        expect(fits!.steps).toHaveLength(4);
        // A take with more onsets than the score has steps cannot be this piece;
        // it falls back to its own notation (three steps).
        const overshoot = {
            ...take,
            composition: {
                ...take.composition,
                notes: [0, 500, 1000, 1500, 2000].map((startMs) => ({
                    pitch: 60,
                    startMs,
                    durationMs: 200,
                    velocity: 90,
                })),
            },
        };
        const fallback = await buildScoreSnapshot(overshoot, { xml, hand: "both" });
        expect(fallback!.steps).toHaveLength(5);
    });
});

describe("treadmill snapshot", () => {
    it("engraves one horizontal line — wider and shallower than the page layout", async () => {
        // A long line of notes, enough to wrap into several systems on the page
        // layout so the two engravings differ meaningfully in shape.
        const long: Take = {
            ...take,
            composition: {
                notes: Array.from({ length: 32 }, (_, index) => ({
                    pitch: 60 + (index % 12),
                    startMs: index * 400,
                    durationMs: 300,
                    velocity: 90,
                })),
                tempo: 120,
                beatsPerBar: 4,
            },
        };
        const page = await buildScoreSnapshot(long);
        const line = await buildScoreSnapshot(long, null, true);
        expect(page).not.toBeNull();
        expect(line).not.toBeNull();
        expect(line!.steps.length).toBe(page!.steps.length);
        // The single line trades height for width.
        expect(line!.width).toBeGreaterThan(page!.width);
        expect(line!.height).toBeLessThan(page!.height);
    });
});
