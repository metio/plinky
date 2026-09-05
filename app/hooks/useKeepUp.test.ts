// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { collectKeepUpSteps, useKeepUp } from "./useKeepUp";

// The painting reaches into OSMD's rendered SVG, which only exists in a real
// browser; stub the colour helpers so the hook's paint-tracking is observable in
// jsdom. highlightCursorNotes returns one painted part so a step counts as painted.
vi.mock("../lib/scoreColor", () => ({
    highlightCursorNotes: () => [{ element: {}, prior: null }],
    litHalos: () => {},
}));

// One voice at a position: a MIDI pitch on a staff (0 = right, 1 = left) with a
// written length in quarter notes, or a rest carrying only a length.
// staff omitted models a note whose engraved ParentStaff is undefined.
type Voice =
    | { midi: number; staff?: number; quarters?: number; tie?: "start" | "stop" }
    | { rest: number };

// A cursor over a fixed sequence of positions, standing in for the OSMD graphic.
// EndReached turns true once the walk steps past the last position, so the
// upfront collection terminates.
function fakeOsmd(positions: Voice[][]) {
    let idx = 0;
    const cursor = {
        reset: () => {
            idx = 0;
        },
        show: () => {},
        hide: () => {},
        next: () => {
            idx += 1;
        },
        NotesUnderCursor: () =>
            (positions[idx] ?? []).map((voice) =>
                "rest" in voice
                    ? {
                          isRest: (): boolean => true,
                          halfTone: 0,
                          Length: { RealValue: voice.rest / 4 },
                      }
                    : {
                          isRest: (): boolean => false,
                          halfTone: voice.midi - 12,
                          // A tie's later note reports a tie whose start is another note.
                          ...(voice.tie === "stop" ? { NoteTie: { StartNote: {} } } : {}),
                          ParentStaff:
                              voice.staff === undefined
                                  ? undefined
                                  : { idInMusicSheet: voice.staff },
                          Length: { RealValue: (voice.quarters ?? 1) / 4 },
                      },
            ),
        get iterator() {
            return {
                EndReached: idx >= positions.length,
                // Each position a crotchet on from the last, so onsets advance the way a
                // real walk's do. A fake reporting the same onset everywhere would let a
                // caller reading the position pass while reading it wrongly.
                currentTimeStamp: { RealValue: idx * 0.25 },
            };
        },
    };
    return { cursor } as unknown as OpenSheetMusicDisplay;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("collectKeepUpSteps", () => {
    it("lifts each position: the hand's pitches with length, and every note's length", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0, quarters: 1 },
                { midi: 48, staff: 1, quarters: 2 },
            ],
            [{ rest: 1 }],
            [{ midi: 62, staff: 0, quarters: 1 }],
        ]);
        // The right hand catches only staff-0 pitches, but the beat length still
        // sees both hands (and the rest), so the clock advances with the notation.
        expect(collectKeepUpSteps(osmd, "right")).toEqual([
            {
                whole: 0,
                play: [{ pitch: 60, quarters: 1 }],
                accompany: [{ pitch: 48, quarters: 2 }],
                lengths: [1, 2],
                bpm: NOMINAL_BPM,
                stretch: 1,
                advancesCursor: true,
            },
            {
                whole: 0.25,
                play: [],
                accompany: [],
                lengths: [1],
                bpm: NOMINAL_BPM,
                stretch: 1,
                advancesCursor: true,
            },
            {
                whole: 0.5,
                play: [{ pitch: 62, quarters: 1 }],
                accompany: [],
                lengths: [1],
                bpm: NOMINAL_BPM,
                stretch: 1,
                advancesCursor: true,
            },
        ]);
        // The left hand catches staff-1 pitches instead, accompanied by staff 0.
        expect(collectKeepUpSteps(osmd, "left")[0]).toEqual({
            whole: 0,
            play: [{ pitch: 48, quarters: 2 }],
            accompany: [{ pitch: 60, quarters: 1 }],
            lengths: [1, 2],
            bpm: NOMINAL_BPM,
            stretch: 1,
            advancesCursor: true,
        });
    });

    it("asks for no re-strike of a tie's later note, but still dwells its length", () => {
        // The key is already down; demanding it again scores a held tie as a miss and has
        // the guide strike it twice. The self-paced matcher and Listen read the tie so.
        const steps = collectKeepUpSteps(
            fakeOsmd([[{ midi: 60, tie: "start" }], [{ midi: 60, tie: "stop" }], [{ midi: 62 }]]),
            "both",
        );
        expect(steps.map((step) => step.play.map((note) => note.pitch))).toEqual([[60], [], [62]]);
        expect(steps[1]?.lengths).toEqual([1]);
    });

    it("leaves a note with no engraved staff out of a single hand's beats, as self-paced does", () => {
        // A single-hand run owns only its own staff; a note the engraving gives no staff
        // can't be proven to be that hand's, so it is the other hand's to accompany — never
        // a beat the player must catch. Keep-up and the self-paced matcher agree here, so a
        // hand choice narrows both modes the same way.
        const osmd = fakeOsmd([[{ midi: 60, quarters: 1 }]]);
        const step = collectKeepUpSteps(osmd, "right")[0]!;
        expect(step.play).toEqual([]);
        expect(step.accompany).toEqual([{ pitch: 60, quarters: 1 }]);
        // A both-hands run still owns it — there is no other hand to hand it to.
        expect(collectKeepUpSteps(osmd, "both")[0]!.play).toEqual([{ pitch: 60, quarters: 1 }]);
    });

    it("leaves nothing to accompany in a both-hands run", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0, quarters: 1 },
                { midi: 48, staff: 1, quarters: 1 },
            ],
        ]);
        const step = collectKeepUpSteps(osmd, "both")[0]!;
        expect(step.play).toEqual([
            { pitch: 60, quarters: 1 },
            { pitch: 48, quarters: 1 },
        ]);
        expect(step.accompany).toEqual([]);
    });
});

describe("useKeepUp", () => {
    it("signals markPainted when a run paints a step, so the next run wipes the trail", () => {
        // A keep-up run paints its window and leaves a green/red hit-miss trail but never
        // restores it; only the markPainted signal lets the surface re-render the trail
        // away before the next run. Without it, a stop-then-restart-in-place would leave
        // the prior run's colours on notes the new run has not reached.
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }]]);
        const markPainted = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted,
                onFinish: () => {},
            }),
        );

        result.current.start({ hand: "both", guideNotes: false, accompany: false });
        // Count-in is one bar (beatMs × beatsPerBar = 250 ms at 240 bpm), then the first
        // tick opens — and paints — the step under the cursor.
        vi.advanceTimersByTime(300);

        expect(markPainted).toHaveBeenCalled();
        result.current.stop();
    });

    it("surfaces the open beat's pitches for the keyboard, and clears them on stop", () => {
        // The keyboard lights "play now" from this; the matcher is stopped during keep-up,
        // so without the run surfacing its own beat the keys would freeze on a stale note.
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }]]);
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );

        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // Count-in (250 ms) then the first tick opens the beat under the cursor.
        act(() => vi.advanceTimersByTime(300));
        expect(result.current.expected).toEqual([60]);
        // The next tick advances the lit beat with the clock.
        act(() => vi.advanceTimersByTime(250));
        expect(result.current.expected).toEqual([62]);

        act(() => result.current.stop());
        expect(result.current.expected).toEqual([]);
    });

    it("plays the other hand as accompaniment in a duet run", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
            ],
        ]);
        const played: number[] = [];
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: (note) => played.push(note) },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );

        // Practise the right hand with the guide off but the duet on.
        result.current.start({ hand: "right", guideNotes: false, accompany: true });
        vi.advanceTimersByTime(300);

        // The left hand (48) sounds as accompaniment; the right hand (60, yours to play) does not.
        expect(played).toContain(48);
        expect(played).not.toContain(60);
        result.current.stop();
    });

    it("hands back the same object across a render that changes nothing", () => {
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }]]);
        const options = {
            getOsmd: () => osmd,
            synth: { playNote: () => {} },
            tempo: () => 240,
            beatsPerBar: 1,
            centerCursor: () => {},
            markPainted: () => {},
            onFinish: () => {},
        };
        const { result, rerender } = renderHook(() => useKeepUp(options));
        const before = result.current;
        rerender();
        expect(result.current).toBe(before);
    });
});
