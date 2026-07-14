// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    cleanKeyMap,
    DEFAULT_KEY_MAP,
    isDefaultKeyMap,
    type KeyMap,
    keyForSlot,
    keyPlaysNote,
    pedalForKey,
    rebind,
    rebindPedal,
} from "./keyMap";

describe("keyForSlot", () => {
    it("finds the key bound to a hand's note slot", () => {
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 0)).toBe("z");
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 7)).toBe("b");
        expect(keyForSlot(DEFAULT_KEY_MAP, "right", 7)).toBe("t");
    });

    it("covers the full octave — A and B have keys of their own", () => {
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 9)).toBe("n");
        expect(keyForSlot(DEFAULT_KEY_MAP, "left", 11)).toBe("m");
        expect(keyForSlot(DEFAULT_KEY_MAP, "right", 9)).toBe("y");
        expect(keyForSlot(DEFAULT_KEY_MAP, "right", 11)).toBe("u");
    });

    it("returns null when nothing is bound to the slot", () => {
        const map: KeyMap = { left: {}, right: {}, pedals: { sustain: null, sostenuto: null, soft: null } };
        expect(keyForSlot(map, "left", 0)).toBeNull();
    });
});

describe("rebind", () => {
    it("binds a free key to a slot", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "l");
        expect(next.left.l).toBe(0);
        expect("z" in next.left).toBe(false);
    });

    it("lowercases the bound key", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "L");
        expect(next.left.l).toBe(0);
    });

    it("drops the slot's previous key so a note has exactly one key", () => {
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "l");
        expect(keyForSlot(next, "left", 0)).toBe("l");
        expect("z" in next.left).toBe(false);
    });

    it("removes the key from any other slot it held, in either hand", () => {
        // Move the right hand's 'q' (its C) onto the left hand's C; 'q' must leave the right.
        const next = rebind(DEFAULT_KEY_MAP, "left", 0, "q");
        expect(next.left.q).toBe(0);
        expect("q" in next.right).toBe(false);
        expect("z" in next.left).toBe(false);
    });

    it("frees the key from a pedal it worked, so it can't fire both", () => {
        // Bind a spare key to the sustain pedal, then rebind that same key to a note.
        const withPedal = rebindPedal(DEFAULT_KEY_MAP, "sustain", "l");
        expect(withPedal.pedals.sustain).toBe("l");
        const next = rebind(withPedal, "left", 0, "l");
        expect(next.left.l).toBe(0);
        // The pedal must let the key go, or keydown (which checks pedals first) would
        // swallow the keystroke and the note would never sound.
        expect(next.pedals.sustain).toBeNull();
    });

    it("does not mutate the input", () => {
        const before = JSON.stringify(DEFAULT_KEY_MAP);
        rebind(DEFAULT_KEY_MAP, "left", 0, "l");
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

    it("rejects a map saved when a hand spanned fewer slots", () => {
        // The eight-slot C–G span an earlier layout stored: too narrow to be
        // usable now, so the whole hand reverts to the full-octave default.
        const narrow = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7 };
        expect(isDefaultKeyMap(cleanKeyMap({ left: narrow, right: narrow }))).toBe(true);
    });

    it("rejects a hand with an out-of-range or duplicate slot", () => {
        expect(isDefaultKeyMap(cleanKeyMap({ left: { ...DEFAULT_KEY_MAP.left, z: 12 } }))).toBe(
            true,
        );
    });

    it("resets the whole layout when the two hands share a key", () => {
        // A full, individually-valid right hand that steals the left hand's 'z'.
        const clashRight = { ...DEFAULT_KEY_MAP.right };
        delete clashRight.q;
        clashRight.z = 0;
        const cleaned = cleanKeyMap({ left: DEFAULT_KEY_MAP.left, right: clashRight });
        expect(isDefaultKeyMap(cleaned)).toBe(true);
    });

    it("keeps a customised but valid map", () => {
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "l");
        const cleaned = cleanKeyMap(custom);
        expect(cleaned.left.l).toBe(0);
        expect(isDefaultKeyMap(cleaned)).toBe(false);
    });
});

describe("isDefaultKeyMap", () => {
    it("is true for the default regardless of key order", () => {
        const { z: _z, ...rest } = DEFAULT_KEY_MAP.left;
        const reordered: KeyMap = {
            left: { ...rest, z: 0 },
            right: DEFAULT_KEY_MAP.right,
            pedals: { sustain: null, sostenuto: null, soft: null },
        };
        expect(isDefaultKeyMap(reordered)).toBe(true);
    });

    it("is false once a key is rebound", () => {
        expect(isDefaultKeyMap(rebind(DEFAULT_KEY_MAP, "right", 7, "."))).toBe(false);
    });
});

describe("pedal bindings", () => {
    it("binds a key to a pedal and reads it back", () => {
        const map = rebindPedal(DEFAULT_KEY_MAP, "sustain", " ");
        expect(map.pedals.sustain).toBe(" ");
        expect(pedalForKey(map, " ")).toBe("sustain");
        expect(pedalForKey(map, "x")).toBeNull();
    });

    it("refuses a note key, leaving both the note and the pedal untouched", () => {
        // "m" plays a note by default. Stealing it for a pedal would leave the hand a slot
        // short — which cleanKeyMap rejects wholesale on the next load, silently dropping the
        // bind — so the request is refused: the note stays, the pedal stays unbound.
        const map = rebindPedal(DEFAULT_KEY_MAP, "sostenuto", "m");
        expect(map.left.m).toBe(11);
        expect(map.pedals.sostenuto).toBeNull();
    });

    it("moves a free key from one pedal to another, never duplicating it", () => {
        let map = rebindPedal(DEFAULT_KEY_MAP, "sostenuto", " ");
        expect(map.pedals.sostenuto).toBe(" ");
        map = rebindPedal(map, "soft", " ");
        expect(map.pedals.sostenuto).toBeNull();
        expect(map.pedals.soft).toBe(" ");
    });

    it("reports whether a key already plays a note", () => {
        expect(keyPlaysNote(DEFAULT_KEY_MAP, "m")).toBe(true);
        expect(keyPlaysNote(DEFAULT_KEY_MAP, "Q")).toBe(true); // case-folded
        expect(keyPlaysNote(DEFAULT_KEY_MAP, " ")).toBe(false);
    });

    it("clears a pedal binding with null", () => {
        const bound = rebindPedal(DEFAULT_KEY_MAP, "sustain", " ");
        expect(rebindPedal(bound, "sustain", null).pedals.sustain).toBeNull();
    });

    it("drops a stored pedal key that collides with a note or another pedal", () => {
        const cleaned = cleanKeyMap({
            left: DEFAULT_KEY_MAP.left,
            right: DEFAULT_KEY_MAP.right,
            // "z" is a note key (collision), " " and "shift" are free but the second
            // sostenuto duplicate of " " must drop.
            pedals: { sustain: "z", sostenuto: " ", soft: " " },
        });
        expect(cleaned.pedals.sustain).toBeNull(); // collided with the z note key
        expect(cleaned.pedals.sostenuto).toBe(" ");
        expect(cleaned.pedals.soft).toBeNull(); // duplicate of the sostenuto key
    });

    it("counts a bound pedal as a customised layout", () => {
        expect(isDefaultKeyMap(rebindPedal(DEFAULT_KEY_MAP, "sustain", " "))).toBe(false);
    });
});
