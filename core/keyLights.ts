// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NoteHints } from "./prefs";

// Which keys a lighted keyboard should be showing, and what has to change to get it
// there. Pure: this decides the picture, the adapter speaks MIDI.
//
// A keyboard whose keys illuminate is a second renderer of what the on-screen keybed
// already draws — the notes the player is meant to reach for next. So the input here
// is the step model the matcher already walks, and nothing about lighting needs its
// own notion of where the run has got to.
//
// The picture is DECLARATIVE. Callers say what should be lit, never "light this" and
// "unlight that": the diff below turns two pictures into the messages between them,
// which is what makes a redundant note-on impossible and guarantees that every light
// switched on has an off owed to it. Imperative lighting is how keys get stranded.

// Lit keys, split by hand, because a lighted keyboard's two navigation channels are
// per hand — Casio's left/right, Yamaha's two Light Parts. Sorted and deduplicated,
// so two pictures of the same keys compare equal.
export type LitKeys = { left: number[]; right: number[] };

export const NOTHING_LIT: LitKeys = { left: [], right: [] };

// A position the run has yet to reach: the pitches that sound there and the staff each
// one sits on, index-aligned. Structurally the matcher's UpcomingStep, taken as a shape
// rather than imported so this stays free of the matcher's own state.
export type UpcomingPosition = { pitches: number[]; pitchStaves: number[] };

// Staff 0 is the treble (right hand), staff 1 the bass (left) — the split the run
// itself matches on. Anything else, including a pitch whose staff the engraver did not
// report, lights on the right, which is where a single-staff piece is read.
const BASS_STAFF = 1;

// How many positions ahead to light, by default.
//
// One: the position the player is on. In self-paced practice that IS lighting ahead
// of time — the key glows before it is played and stays lit until it is cleared,
// because the run advances on the note landing rather than on a clock. Lighting the
// position after it as well would put two indistinguishable lights on the instrument
// with nothing to say which comes first. A tempo-locked run can afford more, because
// there the timing separates them, so the depth is a parameter rather than a constant.
export const DEFAULT_DEPTH = 1;

function tidy(notes: number[]): number[] {
    return [...new Set(notes)].sort((left, right) => left - right);
}

// The picture for the next `depth` positions. Depth 0 lights nothing, which is how
// every "no aid right now" case is expressed — there is no separate off switch.
export function litKeys(upcoming: UpcomingPosition[], depth: number): LitKeys {
    const left: number[] = [];
    const right: number[] = [];
    for (const position of upcoming.slice(0, Math.max(0, depth))) {
        for (const [note, pitch] of position.pitches.entries()) {
            // Each key on the channel of the hand that plays IT. A chord spanning the
            // grand staff used to light every one of its notes on both channels, which
            // on an instrument whose two channels are different colours says the
            // opposite of what the colours are for.
            if (position.pitchStaves[note] === BASS_STAFF) {
                left.push(pitch);
            } else {
                right.push(pitch);
            }
        }
    }
    return { left: tidy(left), right: tidy(right) };
}

// How far ahead to light, from the reading aids already configured.
//
// Lighting a key is a reading aid — the same aid as the on-screen next-note hint, on
// different hardware. So it answers to the same setting rather than a switch of its
// own: a player who turned hints down to "only after a slip" has said what they want
// from every hint, and a sight-read suppresses the lot.
export function depthFor(
    hints: NoteHints,
    // Whether the player has already missed at this position — what "miss" waits for.
    missedHere: boolean,
    // A sight-read: every reading aid is off, whatever the settings say.
    aidsSuppressed: boolean,
    depth: number = DEFAULT_DEPTH,
): number {
    if (aidsSuppressed || hints === "never") {
        return 0;
    }
    if (hints === "miss") {
        return missedHere ? depth : 0;
    }
    return depth;
}

// What has to be sent to move the instrument from one picture to the next: the keys
// newly lit, and the keys no longer lit. A key lit in both pictures appears in
// neither — an instrument already showing it needs telling nothing.
export type LightChange = { on: LitKeys; off: LitKeys };

function without(from: number[], remove: number[]): number[] {
    const gone = new Set(remove);
    return from.filter((note) => !gone.has(note));
}

export function diffLights(previous: LitKeys, next: LitKeys): LightChange {
    return {
        on: {
            left: without(next.left, previous.left),
            right: without(next.right, previous.right),
        },
        off: {
            left: without(previous.left, next.left),
            right: without(previous.right, next.right),
        },
    };
}

export function isLit(keys: LitKeys): boolean {
    return keys.left.length > 0 || keys.right.length > 0;
}

// The chord a "test lights" button sends: a C major triad in the octave every
// lighted 61-key instrument covers, so the player can see at a glance whether the
// device, the channel and the keyboard's own lighting mode all line up.
export const TEST_CHORD: LitKeys = { left: [48, 52, 55], right: [60, 64, 67] };
