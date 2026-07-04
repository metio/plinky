// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    cleanKeyMap,
    DEFAULT_KEY_MAP,
    isDefaultKeyMap,
    type KeyMap,
    keyForSlot,
    rebind,
} from "./keyMap";

describe("keyForSlot", () => {
    it("finds the key bound to a hand's note slot", () => {
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 0)).toBe("a");
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 7)).toBe("g");
        expect(keyForSlot(DEFAULT_KEY_MAP, "right", 7)).toBe(";");
    });

    it("returns null when nothing is bound to the slot", () => {
        const map: KeyMap = { left: {}, right: {} };
        expect(keyForSlot(map, "left", 0)).toBeNull();
    });
});

describe("rebind", () => {
    it("binds a free key to a slot", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        expect(next.left.z).toBe(0);
        expect("a" in next.left).toBe(false);
    });

    it("lowercases the bound key", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "Z");
        expect(next.left.z).toBe(0);
    });

    it("drops the slot's previous key so a note has exactly one key", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        expect(keyForSlot(next, "left", 0)).toBe("z");
        expect("a" in next.left).toBe(false);
    });

    it("removes the key from any other slot it held, in either hand", () => {
        // Move the right hand's 'h' (its C) onto the left hand's C; 'h' must leave the right.
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "h");
        expect(next.left.h).toBe(0);
        expect("h" in next.right).toBe(false);
        expect("a" in next.left).toBe(false);
    });

    it("does not mutate the input", () => {
        const before = JSON.stringify(DEFAULT_KEY_MAP);
        rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        expect(JSON.stringify(DEFAULT_KEY_MAP)).toBe(before);
    });
});

describe("cleanKeyMap", () => {
    it("accepts a full valid map unchanged", () => {
        const clean = cleanKeyMap(DEFAULT_KEY_MAP);
        expect(isDefaultKeyMap(clean)).toBe(true);
    });

    it("falls back to default for junk", () => {
        expect(isDefaultKeyMap(cleanKeyMap(null))).toBe(true);
        expect(isDefaultKeyMap(cleanKeyMap("nope"))).toBe(true);
        expect(isDefaultKeyMap(cleanKeyMap({}))).toBe(true);
    });

    it("rejects a hand that is missing a slot", () => {
        const { g: _drop, ...partialLeft } = DEFAULT_KEY_MAP.left;
        const cleaned = cleanKeyMap({ left: partialLeft, right: DEFAULT_KEY_MAP.right });
        // Left reverts to default; right is preserved.
        expect(cleaned.left).toEqual(DEFAULT_KEY_MAP.left);
        expect(cleaned.right).toEqual(DEFAULT_KEY_MAP.right);
    });

    it("rejects a hand with an out-of-range or duplicate slot", () => {
        expect(isDefaultKeyMap(cleanKeyMap({ left: { ...DEFAULT_KEY_MAP.left, a: 9 } }))).toBe(
            true,
        );
    });

    it("resets the whole layout when the two hands share a key", () => {
        // A full, individually-valid right hand that steals the left hand's 'a'.
        const clashRight = { a: 0, u: 1, j: 2, i: 3, k: 4, l: 5, p: 6, ";": 7 };
        const cleaned = cleanKeyMap({ left: DEFAULT_KEY_MAP.left, right: clashRight });
        expect(isDefaultKeyMap(cleaned)).toBe(true);
    });

    it("keeps a customised but valid map", () => {
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        const cleaned = cleanKeyMap(custom);
        expect(cleaned.left.z).toBe(0);
        expect(isDefaultKeyMap(cleaned)).toBe(false);
    });
});

describe("isDefaultKeyMap", () => {
    it("is true for the default regardless of key order", () => {
        const reordered: KeyMap = {
            left: { g: 7, a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6 },
            right: DEFAULT_KEY_MAP.right,
        };
        expect(isDefaultKeyMap(reordered)).toBe(true);
    });

    it("is false once a key is rebound", () => {
        expect(isDefaultKeyMap(rebind(DEFAULT_KEY_MAP, "right", 7, "."))).toBe(false);
    });
});
