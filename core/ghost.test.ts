// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import {
    decodeGhost,
    encodeGhost,
    formatRaceMargin,
    ghostReached,
    ghostToRace,
    raceVerdict,
} from "./ghost";
import { packToCode } from "./shareCode";

describe("ghost codec", () => {
    it("round-trips a ghost through the compact code", () => {
        const code = encodeGhost([0, 499.6, 1000, 2500]);
        expect(decodeGhost(code)).toEqual([0, 500, 1000, 2500]);
    });

    it("rejects an empty or malformed shared code", () => {
        expect(decodeGhost("")).toBeNull();
        expect(decodeGhost("not-a-real-code")).toBeNull();
    });

    it("rejects a code whose onsets run backwards", () => {
        // A tampered code packing a negative gap would dip the running time below
        // the previous onset, which is never a real recording.
        expect(decodeGhost(packToCode([0, 1000, -600]))).toBeNull();
    });

    it("keeps even the longest song's ghost within a shareable link", () => {
        // ~3,600 ascending onsets with varying gaps — the worst real song — must
        // pack far below the dot-joined size and well under the ~8 KB a shared URL
        // can carry through messaging apps and link unfurlers.
        const onsets: number[] = [];
        let t = 0;
        for (let i = 0; i < 3600; i++) {
            t += 80 + (i % 13) * 11;
            onsets.push(t);
        }
        const code = encodeGhost(onsets);
        const legacyLength = onsets.map((onset) => Math.round(onset)).join(".").length;
        expect(code.length).toBeLessThan(legacyLength / 3);
        expect(code.length).toBeLessThan(8000);
        expect(decodeGhost(code)).toEqual(onsets);
    });

    describe("ghostToRace", () => {
        const take = [0, 100];
        const stored = [0, 200];
        const saved = [0, 300];
        const candidates = {
            fastestTake: () => take,
            stored: () => stored,
            saved: () => saved,
        };

        it("prefers the fastest take, then the stored ghost, then the saved one", () => {
            expect(ghostToRace({ partial: false, raceGhost: true, ...candidates })).toEqual(take);
            expect(
                ghostToRace({
                    partial: false,
                    raceGhost: true,
                    ...candidates,
                    fastestTake: () => null,
                }),
            ).toEqual(stored);
            expect(
                ghostToRace({
                    partial: false,
                    raceGhost: true,
                    ...candidates,
                    fastestTake: () => null,
                    stored: () => null,
                }),
            ).toEqual(saved);
        });

        it("races nothing when every candidate is empty", () => {
            expect(
                ghostToRace({
                    partial: false,
                    raceGhost: true,
                    fastestTake: () => null,
                    stored: () => null,
                    saved: () => null,
                }),
            ).toBeNull();
        });

        it.each([
            ["a partial run starts mid-piece", { partial: true, raceGhost: true }],
            ["an ephemeral piece keeps no ghost", { partial: false, ephemeral: true, raceGhost: true }],
            ["the player declined the race", { partial: false, raceGhost: false }],
        ])("races nothing when %s", (_reason, options) => {
            expect(ghostToRace({ ...options, ...candidates })).toBeNull();
        });

        it("leaves a lower-precedence candidate unread when a higher one answers", () => {
            const savedProbe = vi.fn(() => saved);
            ghostToRace({ partial: false, raceGhost: true, ...candidates, saved: savedProbe });
            expect(savedProbe).not.toHaveBeenCalled();
        });

        it("reads no candidate at all when nothing is raced", () => {
            const probe = vi.fn(() => take);
            ghostToRace({
                partial: true,
                raceGhost: true,
                fastestTake: probe,
                stored: probe,
                saved: probe,
            });
            expect(probe).not.toHaveBeenCalled();
        });
    });

    it("counts the notes a ghost has reached by an elapsed time", () => {
        const onsets = [0, 500, 1000, 1500];
        expect(ghostReached(onsets, -1)).toBe(0);
        expect(ghostReached(onsets, 0)).toBe(1);
        expect(ghostReached(onsets, 1200)).toBe(3);
        expect(ghostReached(onsets, 9999)).toBe(4);
    });

    describe("raceVerdict", () => {
        // The ghost's total time is its last onset — here, 4000 ms.
        const ghost = [0, 1000, 2000, 4000];

        it("declares a win when you finish clearly sooner than the ghost", () => {
            expect(raceVerdict(ghost, 3500)).toEqual({ outcome: "won", marginMs: 500 });
        });

        it("declares a loss when you finish clearly later than the ghost", () => {
            expect(raceVerdict(ghost, 4600)).toEqual({ outcome: "lost", marginMs: 600 });
        });

        it("calls a near-simultaneous finish a dead heat", () => {
            expect(raceVerdict(ghost, 4050)?.outcome).toBe("tie");
            expect(raceVerdict(ghost, 3950)?.outcome).toBe("tie");
        });

        it("has no verdict without a ghost to race", () => {
            expect(raceVerdict([], 1000)).toBeNull();
        });
    });

    describe("formatRaceMargin", () => {
        it("reads the margin as compact seconds", () => {
            expect(formatRaceMargin(2340)).toBe("2.3s");
            expect(formatRaceMargin(0)).toBe("0.0s");
            expect(formatRaceMargin(12040)).toBe("12.0s");
        });
    });
});
