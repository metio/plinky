// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { heldNotes } from "./heldNotes";

// What the on-screen keyboard is sounding, and which pointer is on which key.
//
// The keybed answers to three kinds of source: pointers, which move and so need
// tracking between events; the computer key that activates the roved key; and the click
// a screen reader synthesizes. All three share the note counting underneath
// (core/heldNotes), because a note sounds while any one of them holds it.
//
// Every method answers with the edges it crossed — the note that started sounding and
// the note that stopped — because that is what the keyboard acts on. A press that joins
// a note another source already holds crosses nothing and is reported as nothing, which
// is what keeps a second finger from restriking a key and an assistive-tech auto-release
// from cutting a real press.

export type Edge = { pressed: number | null; released: number | null };

const NOTHING: Edge = { pressed: null, released: null };

// A pointer's source name. Sources are strings so a pointer, a key and a click can share
// one count without one spelling the other's name.
const pointerSource = (pointerId: number) => `p${pointerId}`;

export type Keybed = {
    // A press landing on a key. The pointer is tracked from here until it ends, whether
    // or not it is over a key at the time.
    pointerDown(pointerId: number, note: number): Edge;
    // The same press somewhere else: another key, or off the keys entirely (null), which
    // releases what it sounded but leaves it live, so re-entering a key presses again.
    // A pointer this keybed is not tracking moves nothing.
    pointerTo(pointerId: number, note: number | null): Edge;
    // The press ending, by lift or by cancel. A pointer this keybed is not tracking ends
    // nothing, so a stray window-level backstop cannot silence another keybed's notes.
    pointerEnd(pointerId: number): Edge;
    // Whether this pointer is one of ours, which a move asks before hit-testing.
    tracks(pointerId: number): boolean;
    // The note a pointer is sounding, or null when it is down but off the keys.
    noteOf(pointerId: number): number | null;
    // The sources that do not move: the computer key and the screen reader's click.
    press(source: string, note: number): Edge;
    release(source: string, note: number): Edge;
    // Everything one source holds, and everything every source holds — the keyboard
    // leaving the page mid-press, where no release event will ever arrive.
    releaseSource(source: string): number[];
    releaseAll(): number[];
    sounding(): number[];
};

export function keybed(): Keybed {
    const held = heldNotes();
    // The note each tracked pointer sounds. A pointer that is down but off the keys is
    // tracked with null, which is what separates "not ours" from "ours, between keys".
    const at = new Map<number, number | null>();

    const moveTo = (pointerId: number, note: number | null): Edge => {
        const was = at.get(pointerId) ?? null;
        if (was === note) {
            return NOTHING;
        }
        const source = pointerSource(pointerId);
        const released = was !== null && held.release(source, was) ? was : null;
        at.set(pointerId, note);
        if (note === null) {
            return { pressed: null, released };
        }
        return { pressed: held.press(source, note) ? note : null, released };
    };

    return {
        pointerDown(pointerId, note) {
            at.set(pointerId, at.get(pointerId) ?? null);
            return moveTo(pointerId, note);
        },
        pointerTo(pointerId, note) {
            return at.has(pointerId) ? moveTo(pointerId, note) : NOTHING;
        },
        pointerEnd(pointerId) {
            if (!at.has(pointerId)) {
                return NOTHING;
            }
            const { released } = moveTo(pointerId, null);
            at.delete(pointerId);
            return { pressed: null, released };
        },
        tracks: (pointerId) => at.has(pointerId),
        noteOf: (pointerId) => at.get(pointerId) ?? null,
        press: (source, note) => ({
            pressed: held.press(source, note) ? note : null,
            released: null,
        }),
        release: (source, note) => ({
            pressed: null,
            released: held.release(source, note) ? note : null,
        }),
        releaseSource: (source) => held.releaseSource(source),
        releaseAll() {
            at.clear();
            return held.releaseAll();
        },
        sounding: () => held.sounding(),
    };
}
