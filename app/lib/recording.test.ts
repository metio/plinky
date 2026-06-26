// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { ghostReached, loadGhost, saveGhost } from "./recording";

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

    it("counts the notes a ghost has reached by an elapsed time", () => {
        const onsets = [0, 500, 1000, 1500];
        expect(ghostReached(onsets, -1)).toBe(0);
        expect(ghostReached(onsets, 0)).toBe(1);
        expect(ghostReached(onsets, 1200)).toBe(3);
        expect(ghostReached(onsets, 9999)).toBe(4);
    });
});
