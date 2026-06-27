// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { decodeGhost, encodeGhost, ghostReached, loadGhost, saveGhost } from "./recording";

afterEach(() => localStorage.clear());

describe("recording", () => {
    it("round-trips a ghost per score", () => {
        saveGhost("twinkle", [0, 500, 1000]);
        expect(loadGhost("twinkle")).toEqual([0, 500, 1000]);
        expect(loadGhost("other")).toBeNull();
    });

    it("rejects malformed stored data", () => {
        localStorage.setItem("plinky:ghost:x", JSON.stringify({ not: "an array" }));
        expect(loadGhost("x")).toBeNull();
    });

    it("round-trips a ghost through the compact code", () => {
        const code = encodeGhost([0, 499.6, 1000, 2500]);
        expect(decodeGhost(code)).toEqual([0, 500, 1000, 2500]);
    });

    it("still decodes the legacy dot-joined shape", () => {
        expect(decodeGhost("0.500.1000")).toEqual([0, 500, 1000]);
    });

    it("rejects a malformed or out-of-order shared code", () => {
        expect(decodeGhost("")).toBeNull();
        expect(decodeGhost("0.nope.1000")).toBeNull();
        expect(decodeGhost("0.1000.500")).toBeNull();
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
