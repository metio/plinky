// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createGhostStore } from "./ghostStore";

describe("ghostStore", () => {
    it("round-trips a ghost per score", () => {
        const ghosts = createGhostStore(memoryStore());
        expect(ghosts.save("twinkle", [0, 500, 1000])).toBe(true);
        expect(ghosts.load("twinkle")).toEqual([0, 500, 1000]);
        expect(ghosts.load("other")).toBeNull();
    });

    it("reads malformed or empty stored data as no ghost", () => {
        const kv = memoryStore({
            "plinky:ghost:x": JSON.stringify({ not: "an array" }),
            "plinky:ghost:y": "[]",
        });
        const ghosts = createGhostStore(kv);
        expect(ghosts.load("x")).toBeNull();
        expect(ghosts.load("y")).toBeNull();
    });

    it("drops non-numeric entries rather than racing NaN", () => {
        const kv = memoryStore({ "plinky:ghost:x": JSON.stringify([0, "fast", 500]) });
        expect(createGhostStore(kv).load("x")).toEqual([0, 500]);
    });

    it("notifies subscribers on save and reports a refused write", () => {
        const ghosts = createGhostStore(memoryStore());
        const onChange = vi.fn();
        ghosts.subscribe(onChange);
        ghosts.save("a", [1]);
        expect(onChange).toHaveBeenCalledTimes(1);
        const refusing = createGhostStore({ ...memoryStore(), set: () => false });
        expect(refusing.save("a", [1])).toBe(false);
    });
});
