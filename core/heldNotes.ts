// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which notes the on-screen keyboard is sounding, and which sources are holding each one.
//
// A note sounds while at least one source holds it. A source is whatever pressed the key:
// a pointer, the computer key that activates the roved key, or the click a screen reader
// synthesizes. Counting them per note is what lets two fingers share one key without the
// first to lift silencing it, and what keeps a real press alive when an assistive-tech
// auto-release fires for its own source.
//
// The keyboard sounds a note on the transition into held and releases it on the way out,
// so what a caller needs from every method is whether that edge was crossed — never the
// count, which is bookkeeping rather than something to act on.

export type HeldNotes = {
    // True when this press is what started the note sounding, so the caller sounds it.
    // A source already holding the note presses nothing: the same finger cannot press
    // one key twice, and a repeat from an auto-repeating computer key is not a restrike.
    press(source: string, note: number): boolean;
    // True when this release is what silenced the note. A source that is not holding it
    // releases nothing, so a stray release — an auto-release for a source that already
    // lifted, an event for a key a glide has left — cannot cut a note another source
    // is still holding.
    release(source: string, note: number): boolean;
    // Everything one source holds, silenced at once: a pointer lifting or cancelling,
    // a screen reader's auto-release, the computer key coming up. Returns the notes that
    // stopped sounding, in the order they were pressed.
    releaseSource(source: string): number[];
    // Every note, whatever holds it: the keyboard leaving the page mid-press, where no
    // release event will ever arrive and a voice would otherwise ring on.
    releaseAll(): number[];
    // The notes sounding, in the order they started, for a caller that paints them.
    sounding(): number[];
    // Whether this source holds this note, which a glide asks before pressing a key it
    // may already be on.
    holds(source: string, note: number): boolean;
};

export function heldNotes(): HeldNotes {
    // Insertion order is the order notes started sounding, which Map and Set both keep.
    const sources = new Map<number, Set<string>>();

    const press = (source: string, note: number) => {
        let holding = sources.get(note);
        if (!holding) {
            holding = new Set();
            sources.set(note, holding);
        }
        const silent = holding.size === 0;
        holding.add(source);
        return silent;
    };

    const release = (source: string, note: number) => {
        const holding = sources.get(note);
        if (!holding?.has(source)) {
            return false;
        }
        holding.delete(source);
        if (holding.size > 0) {
            return false;
        }
        sources.delete(note);
        return true;
    };

    return {
        press,
        release,
        releaseSource(source) {
            const silenced: number[] = [];
            for (const note of [...sources.keys()]) {
                if (release(source, note)) {
                    silenced.push(note);
                }
            }
            return silenced;
        },
        releaseAll() {
            const silenced = [...sources.keys()];
            sources.clear();
            return silenced;
        },
        sounding: () => [...sources.keys()],
        holds: (source, note) => sources.get(note)?.has(source) === true,
    };
}
