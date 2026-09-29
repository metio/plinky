// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    closeKeepUpStep,
    keepUpProgress,
    type KeepUpState,
    openKeepUpStep,
    settleKeepUp,
    startKeepUp,
    strikeKeepUp,
} from "./keepUp";

// Keeping up with the piece: each beat opens owing some pitches, the player strikes, and
// the beat closes with a verdict. The verdict is what the player is shown, so what these
// pin is that it says what happened — every owed pitch struck is a hit, a missing one is
// not, and a key the beat never asked for changes nothing.
//
// A beat's verdict is settled when the NEXT beat closes, so the run ends with a settle to
// flush the last one. That lag is the thing most easily got wrong, and the reason these
// walk whole runs rather than single beats.

const POOL = [60, 62, 64, 67, 69];
const DWELL = 500;

type Beat = { pitches: number[]; play: "all" | "some" | "none" };

const arbBeat: fc.Arbitrary<Beat> = fc
    .tuple(
        fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 3 }),
        fc.constantFrom("all" as const, "some" as const, "none" as const),
    )
    .map(([pitches, play]) => ({ pitches, play }));

// What a beat is owed and what the player gives it. "some" means at least one short,
// which is only possible where the beat asks for more than one.
const struckOf = (beat: Beat) => {
    if (beat.play === "all") {
        return beat.pitches;
    }
    if (beat.play === "none") {
        return [];
    }
    return beat.pitches.slice(0, Math.max(0, beat.pitches.length - 1));
};

const playRun = (beats: Beat[]) => {
    let state: KeepUpState = startKeepUp();
    let at = 1000;
    for (const [index, beat] of beats.entries()) {
        state = openKeepUpStep(state, beat.pitches, {
            at,
            dwellMs: DWELL,
            next: beats[index + 1]?.pitches ?? [],
        });
        // Struck in the middle of the beat's dwell: past the late window of the beat
        // before it, which would otherwise claim a repeated note as its own, and before
        // the early window of the beat after it, which would claim it as rushed.
        for (const pitch of struckOf(beat)) {
            state = strikeKeepUp(state, pitch, at + 200).state;
        }
        at += DWELL;
        state = closeKeepUpStep(state, at).state;
    }
    // The last beat's verdict is still open until something settles it.
    return settleKeepUp(state).state;
};

const verdictsOf = (beats: Beat[]) =>
    beats.map((beat) => struckOf(beat).length === beat.pitches.length);

describe("keepUp, over a run of beats", () => {
    it("says of every beat what the player actually did", () => {
        fc.assert(
            fc.property(fc.array(arbBeat, { maxLength: 12 }), (beats) => {
                const state = playRun(beats);

                expect(state.hits).toEqual(verdictsOf(beats));
            }),
        );
    });

    it("counts what it says", () => {
        fc.assert(
            fc.property(fc.array(arbBeat, { maxLength: 12 }), (beats) => {
                const state = playRun(beats);
                const { inTime, done } = keepUpProgress(state);

                expect(done).toBe(state.hits.length);
                expect(inTime).toBe(state.hits.filter(Boolean).length);
                expect(inTime).toBeLessThanOrEqual(done);
                expect(done).toBe(beats.length);
            }),
        );
    });

    it("leaves a verdict alone once it is given", () => {
        fc.assert(
            fc.property(fc.array(arbBeat, { maxLength: 10 }), (beats) => {
                let state: KeepUpState = startKeepUp();
                let at = 1000;
                let sofar: boolean[] = [];
                for (const [index, beat] of beats.entries()) {
                    state = openKeepUpStep(state, beat.pitches, {
                        at,
                        dwellMs: DWELL,
                        next: beats[index + 1]?.pitches ?? [],
                    });
                    for (const pitch of struckOf(beat)) {
                        state = strikeKeepUp(state, pitch, at + 200).state;
                    }
                    at += DWELL;
                    state = closeKeepUpStep(state, at).state;
                    // Whatever has been settled so far stays settled, in the same order.
                    expect(state.hits.slice(0, sofar.length)).toEqual(sofar);
                    sofar = state.hits;
                }
            }),
        );
    });

    it("ignores a key the beat never asked for", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 3 }),
                fc.integer({ min: 21, max: 47 }),
                (pitches, stray) => {
                    const open = openKeepUpStep(startKeepUp(), pitches, {
                        at: 1000,
                        dwellMs: DWELL,
                        next: [],
                    });

                    const { state, expected, caught } = strikeKeepUp(open, stray, 1010);

                    expect(expected).toBe(false);
                    expect(caught).toBe(false);
                    expect(state).toBe(open);
                },
            ),
        );
    });

    it("takes a key twice as once", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 3 }),
                (pitches) => {
                    let state = openKeepUpStep(startKeepUp(), pitches, {
                        at: 1000,
                        dwellMs: DWELL,
                        next: [],
                    });
                    for (const pitch of [...pitches, ...pitches]) {
                        state = strikeKeepUp(state, pitch, 1010).state;
                    }

                    expect(state.struck).toEqual(pitches);
                    expect(closeKeepUpStep(state, 1500).state.closing?.struck).toEqual(pitches);
                },
            ),
        );
    });

    it("counts a note struck a moment late for the beat that owed it", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POOL),
                fc.integer({ min: 0, max: 100 }),
                (pitch, late) => {
                    const open = openKeepUpStep(startKeepUp(), [pitch], {
                        at: 1000,
                        dwellMs: DWELL,
                        next: [],
                    });
                    // Nothing struck while it was open: the beat closes owing its note.
                    const closed = closeKeepUpStep(open, 1000 + DWELL).state;

                    const after = strikeKeepUp(closed, pitch, 1000 + DWELL + late).state;

                    expect(settleKeepUp(after).hit).toBe(true);
                    // A hair later than the window, and the beat has gone without it.
                    const tooLate = strikeKeepUp(closed, pitch, 1000 + DWELL + 101).state;
                    expect(settleKeepUp(tooLate).hit).toBe(false);
                },
            ),
        );
    });

    it("settles nothing when nothing is closing", () => {
        const fresh = startKeepUp();

        const { state, hit } = settleKeepUp(fresh);

        expect(hit).toBeNull();
        expect(state).toBe(fresh);
    });
});
