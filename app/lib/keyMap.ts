// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The computer-keyboard layout: which physical key plays each of the eight notes
// (C C♯ D D♯ E F F♯ G) under each hand. The default is the five-finger home-row
// split — left hand on A S D F G (+ W E T for the black keys), right hand an octave
// up on H J K L ; (+ U I P) — but a player can rebind any key, so the layout lives
// in prefs and the keyboard input layer reads it from here.

export type Hand = "left" | "right";

// A key→semitone map per hand. Each value is the semitone offset (0–7) from that
// hand's base C; the key strings are lowercased, matching `KeyboardEvent.key`.
export type KeyMap = { left: Record<string, number>; right: Record<string, number> };

// The eight playable slots in one hand's span: C through G with the three black
// keys among them. Index is the semitone offset stored in the map.
export const SEMITONES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

// Display labels for each semitone slot, sharps spelled with ♯.
export const NOTE_LABELS: Record<number, string> = {
    0: "C",
    1: "C♯",
    2: "D",
    3: "D♯",
    4: "E",
    5: "F",
    6: "F♯",
    7: "G",
};

export const HANDS: Hand[] = ["left", "right"];

export const DEFAULT_KEY_MAP: KeyMap = {
    left: { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7 },
    right: { h: 0, u: 1, j: 2, i: 3, k: 4, l: 5, p: 6, ";": 7 },
};

function cloneMap(map: KeyMap): KeyMap {
    return { left: { ...map.left }, right: { ...map.right } };
}

// The key currently bound to a hand's note slot, or null when nothing is bound.
export function keyForSlot(map: KeyMap, hand: Hand, semitone: number): string | null {
    for (const [key, value] of Object.entries(map[hand])) {
        if (value === semitone) {
            return key;
        }
    }
    return null;
}

// Bind `key` to (hand, semitone). A key plays only one note, so it is first removed
// from any slot it held in either hand; the slot's previous key is dropped too. The
// result keeps each key unique across the whole layout.
export function rebind(map: KeyMap, hand: Hand, semitone: number, key: string): KeyMap {
    const lower = key.toLowerCase();
    const next = cloneMap(map);
    for (const h of HANDS) {
        delete next[h][lower];
    }
    for (const [existing, value] of Object.entries(next[hand])) {
        if (value === semitone) {
            delete next[hand][existing];
        }
    }
    next[hand][lower] = semitone;
    return next;
}

// A hand is usable only as a complete, unambiguous span: exactly the eight slots
// 0–7, each held by a distinct non-empty key. A partially-corrupt hand is rejected
// wholesale (the caller substitutes the default) rather than half-repaired into a
// surprising layout.
function validHand(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length !== SEMITONES.length) {
        return null;
    }
    const slots = new Set<number>();
    const result: Record<string, number> = {};
    for (const [key, slot] of entries) {
        if (typeof key !== "string" || key.length < 1 || typeof slot !== "number") {
            return null;
        }
        if (!Number.isInteger(slot) || slot < 0 || slot > 7 || slots.has(slot)) {
            return null;
        }
        slots.add(slot);
        result[key.toLowerCase()] = slot;
    }
    return result;
}

// Validate a stored map, falling back to the default for any hand that isn't a clean
// full span. A key may play only one note, so if the two hands share a key the whole
// layout is reset rather than silently letting one keystroke fire two notes.
export function cleanKeyMap(value: unknown): KeyMap {
    const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const left = validHand(source.left) ?? { ...DEFAULT_KEY_MAP.left };
    const right = validHand(source.right) ?? { ...DEFAULT_KEY_MAP.right };
    const collides = Object.keys(left).some((key) => key in right);
    return collides
        ? { left: { ...DEFAULT_KEY_MAP.left }, right: { ...DEFAULT_KEY_MAP.right } }
        : { left, right };
}

function sameHand(a: Record<string, number>, b: Record<string, number>): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function isDefaultKeyMap(map: KeyMap): boolean {
    return sameHand(map.left, DEFAULT_KEY_MAP.left) && sameHand(map.right, DEFAULT_KEY_MAP.right);
}
