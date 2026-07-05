// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createFingeringStore, fingerKey } from "./fingeringStore";

describe("fingeringStore", () => {
    it("persists a finger choice and reads it back by score position", () => {
        const kv = memoryStore();
        const fingering = createFingeringStore(kv);
        const { map, stored } = fingering.setFinger("song", {}, "right", 2, 0, 1, 3);
        expect(stored).toBe(true);
        expect(map[fingerKey("right", 2, 0, 1)]).toBe(3);
        expect(fingering.load("song")).toEqual({ "right:2:0:1": 3 });
        // A second instance over the same backing store reads the same truth.
        expect(createFingeringStore(kv).load("song")).toEqual({ "right:2:0:1": 3 });
    });

    it("keeps fingerings separate per song", () => {
        const fingering = createFingeringStore(memoryStore());
        fingering.setFinger("a", {}, "right", 0, 0, 0, 2);
        expect(fingering.load("b")).toEqual({});
    });

    it("drops corrupt or out-of-range entries on load", () => {
        const kv = memoryStore({
            "plinky:fingering:x": JSON.stringify({
                "right:0:0:0": 3,
                "right:0:0:1": 9,
                "right:0:0:2": "x",
            }),
        });
        expect(createFingeringStore(kv).load("x")).toEqual({ "right:0:0:0": 3 });
    });

    it("clears a song's fingering and notifies", () => {
        const fingering = createFingeringStore(memoryStore());
        fingering.setFinger("song", {}, "left", 1, 0, 0, 4);
        const onChange = vi.fn();
        fingering.subscribe(onChange);
        fingering.clear("song");
        expect(fingering.load("song")).toEqual({});
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("reports a refused write while still returning the updated map", () => {
        const fingering = createFingeringStore({ ...memoryStore(), set: () => false });
        const { map, stored } = fingering.setFinger("song", {}, "right", 1, 0, 0, 2);
        // The choice still renders this session, but the caller knows it will
        // not survive a reload.
        expect(stored).toBe(false);
        expect(map[fingerKey("right", 1, 0, 0)]).toBe(2);
        expect(fingering.load("song")).toEqual({});
    });
});
