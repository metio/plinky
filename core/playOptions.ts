// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Hand } from "./matcher";

// What a link can say about how a piece should open.
//
// A practice suggestion is only advice until it can hand you the control that does it. Three
// of the six ways to practise are done with a control inside the run set-up panel, so before
// this a button could only land on the catalogue and leave the reader hunting — which is why
// the page carried no buttons at all. A link that opens a piece already slowed down, or with
// one hand switched off, is the difference between reading about practice and practising.
//
// The fields are the ones that belong to a SESSION. The metronome and blank noteheads are
// saved preferences, and a link that rewrote somebody's saved settings on their way to a
// piece would be taking something that was not offered — those stay out until there is a
// seam that can override a preference for one run without storing it.
//
// Every field is a STARTING value, never a lock: the player changes any of it the moment the
// page is open, and nothing writes back to the address. A teacher's link therefore sets a
// student up rather than holding them there.
//
// Nothing here throws or reports. A link is typed by hand, forwarded, truncated by a chat
// client and pasted back together, so a value that makes no sense is simply not applied —
// landing on the piece with a default is always better than landing on an error.

export type PlayOptions = {
    // A multiplier on the piece's own tempo, not an absolute BPM: a link that says "slowly"
    // has to mean the same thing on a piece marked 60 and one marked 160.
    speed?: number;
    hands?: Hand;

    // Semitones, the same units the transpose control uses.
    transpose?: number;
    // An inclusive bar range to loop, one-based, as the score prints them.
    loop?: { from: number; to: number };
};

// Slower than a quarter speed is not practice, and faster than double is not a tempo anyone
// asked a link for. Both ends are held so a mistyped `speed=100` opens the piece rather than
// racing it past the point of sound.
const MIN_SPEED = 0.25;
const MAX_SPEED = 2;

// The transpose control's own range. A link cannot ask for a key the page cannot show.
const MAX_TRANSPOSE = 12;

const HANDS: readonly Hand[] = ["both", "left", "right"];

function readNumber(raw: string | null): number | undefined {
    if (raw === null || raw.trim() === "") return undefined;
    const value = Number(raw);
    // Number("") is 0 and Number(" ") is 0, which is why the blank check comes first;
    // Infinity is a number and would survive a bare isNaN.
    return Number.isFinite(value) ? value : undefined;
}

// "5-8", or "5" for a single bar. Reversed ranges are read the way they were meant rather
// than dropped: somebody who writes 8-5 wants bars 5 to 8.
function readLoop(raw: string | null): PlayOptions["loop"] {
    if (raw === null) return undefined;
    const parts = raw.split("-");
    if (parts.length > 2) return undefined;
    const first = readNumber(parts[0] ?? null);
    const second = parts.length === 2 ? readNumber(parts[1] ?? null) : first;
    if (first === undefined || second === undefined) return undefined;
    if (!Number.isInteger(first) || !Number.isInteger(second)) return undefined;
    if (first < 1 || second < 1) return undefined;
    return { from: Math.min(first, second), to: Math.max(first, second) };
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value));
}

// Reads what a link asks for. Takes the lookup rather than a URLSearchParams so it stays
// usable from anywhere — a router's params, a plain object, a test.
export function readPlayOptions(get: (key: string) => string | null): PlayOptions {
    const options: PlayOptions = {};

    const speed = readNumber(get("speed"));
    // A speed of zero is silence rather than slowness, so it is refused rather than clamped
    // up to the minimum — nobody who writes 0 meant a quarter.
    if (speed !== undefined && speed > 0) options.speed = clamp(speed, MIN_SPEED, MAX_SPEED);

    const hands = get("hands");
    if (hands !== null && (HANDS as readonly string[]).includes(hands)) {
        options.hands = hands as Hand;
    }

    const transpose = readNumber(get("transpose"));
    if (transpose !== undefined && Number.isInteger(transpose)) {
        options.transpose = clamp(transpose, -MAX_TRANSPOSE, MAX_TRANSPOSE);
    }

    const loop = readLoop(get("loop"));
    if (loop !== undefined) options.loop = loop;

    return options;
}

// The other direction: what a suggestion writes into its own link. Only the fields that were
// asked for appear, so a link stays as short as what it actually says.
export function playOptionsQuery(options: PlayOptions): string {
    const params = new URLSearchParams();
    if (options.speed !== undefined) params.set("speed", String(options.speed));
    if (options.hands !== undefined) params.set("hands", options.hands);
    if (options.transpose !== undefined) params.set("transpose", String(options.transpose));
    if (options.loop !== undefined) params.set("loop", `${options.loop.from}-${options.loop.to}`);
    const query = params.toString();
    return query === "" ? "" : `?${query}`;
}
