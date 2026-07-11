// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The computer-keyboard layout: which physical key plays each of the twelve notes
// of one octave (C through B) under each hand. The default is the classic
// virtual-piano split — left hand on the bottom letter row (Z X C V B N M white,
// S D G H J black), right hand an octave up on the top letter row (Q W E R T Y U
// white, 2 3 5 6 7 black) — so every note of a piece is reachable, A and B
// included. A player can rebind any key, so the layout lives in prefs and the
// keyboard input layer reads it from here.

export type Hand = "left" | "right";

// A key→semitone map per hand. Each value is the semitone offset (0–7) from that
// hand's base C; the key strings are lowercased, matching `KeyboardEvent.key`.
export type KeyMap = { left: Record<string, number>; right: Record<string, number> };

// The twelve playable slots in one hand's span: a full octave, C through B.
// Index is the semitone offset stored in the map.
export const SEMITONES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

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
    8: "G♯",
    9: "A",
    10: "A♯",
    11: "B",
};

export const HANDS: Hand[] = ["left", "right"];

export const DEFAULT_KEY_MAP: KeyMap = {
    left: { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11 },
    right: { q: 0, "2": 1, w: 2, "3": 3, e: 4, r: 5, "5": 6, t: 7, "6": 8, y: 9, "7": 10, u: 11 },
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

// A hand is usable only as a complete, unambiguous span: exactly the twelve slots
// 0–11, each held by a distinct non-empty key. A partially-corrupt hand — or a map
// saved when the span was narrower — is rejected wholesale (the caller substitutes
// the default) rather than half-repaired into a surprising layout.
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
        if (!Number.isInteger(slot) || slot < 0 || slot > 11 || slots.has(slot)) {
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
