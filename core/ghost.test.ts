// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { decodeGhost, encodeGhost, ghostReached } from "./ghost";
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

    it("counts the notes a ghost has reached by an elapsed time", () => {
        const onsets = [0, 500, 1000, 1500];
        expect(ghostReached(onsets, -1)).toBe(0);
        expect(ghostReached(onsets, 0)).toBe(1);
        expect(ghostReached(onsets, 1200)).toBe(3);
        expect(ghostReached(onsets, 9999)).toBe(4);
    });
});
