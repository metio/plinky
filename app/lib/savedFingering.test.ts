// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeniedStorage } from "./deniedStorage";
import { clearSongFingering, fingerKey, loadSongFingering, setFinger } from "./savedFingering";

afterEach(() => localStorage.clear());

describe("savedFingering", () => {
    it("persists a finger choice and reads it back by score position", () => {
        const { map, stored } = setFinger("song", {}, "right", 2, 0, 1, 3);
        expect(stored).toBe(true);
        expect(map[fingerKey("right", 2, 0, 1)]).toBe(3);
        expect(loadSongFingering("song")).toEqual({ "right:2:0:1": 3 });
    });

    it("reports a refused write while still returning the updated map", () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        const { map, stored } = setFinger("song", {}, "right", 1, 0, 0, 2);
        setItem.mockRestore();
        // The choice still renders this session, but the caller knows it will
        // not survive a reload.
        expect(stored).toBe(false);
        expect(map[fingerKey("right", 1, 0, 0)]).toBe(2);
        expect(loadSongFingering("song")).toEqual({});
    });

    it("keeps fingerings separate per song", () => {
        setFinger("a", {}, "right", 0, 0, 0, 2);
        expect(loadSongFingering("b")).toEqual({});
    });

    it("drops corrupt or out-of-range entries on load", () => {
        localStorage.setItem(
            "plinky:fingering:x",
            JSON.stringify({ "right:0:0:0": 3, "right:0:0:1": 9, "right:0:0:2": "x" }),
        );
        expect(loadSongFingering("x")).toEqual({ "right:0:0:0": 3 });
    });

    it("clears a song's fingering", () => {
        setFinger("song", {}, "left", 1, 0, 0, 4);
        clearSongFingering("song");
        expect(loadSongFingering("song")).toEqual({});
    });
});

describe("savedFingering under denied storage", () => {
    it("reads an empty map rather than throwing when storage is blocked", () => {
        expect(withDeniedStorage(() => loadSongFingering("song"))).toEqual({});
    });

    it("reports a finger write as unlanded when storage is blocked", () => {
        expect(withDeniedStorage(() => setFinger("song", {}, "right", 1, 0, 1, 3).stored)).toBe(
            false,
        );
    });

    it("swallows a clear when storage is blocked", () => {
        expect(() => withDeniedStorage(() => clearSongFingering("song"))).not.toThrow();
    });
});
