// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectKeepUpSteps, useKeepUp } from "./useKeepUp";

// The painting reaches into OSMD's rendered SVG, which only exists in a real
// browser; stub the colour helpers so the hook's paint-tracking is observable in
// jsdom. highlightCursorNotes returns one painted part so a step counts as painted.
vi.mock("../lib/scoreColor", () => ({
    highlightCursorNotes: () => [{ element: {}, prior: null }],
    litHalo: () => {},
}));

// One voice at a position: a MIDI pitch on a staff (0 = right, 1 = left) with a
// written length in quarter notes, or a rest carrying only a length.
type Voice = { midi: number; staff: number; quarters?: number } | { rest: number };

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
                          ParentStaff: { idInMusicSheet: voice.staff },
                          Length: { RealValue: (voice.quarters ?? 1) / 4 },
                      },
            ),
        get iterator() {
            return { EndReached: idx >= positions.length };
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
            { play: [{ pitch: 60, quarters: 1 }], lengths: [1, 2] },
            { play: [], lengths: [1] },
            { play: [{ pitch: 62, quarters: 1 }], lengths: [1] },
        ]);
        // The left hand catches staff-1 pitches instead.
        expect(collectKeepUpSteps(osmd, "left")[0]).toEqual({
            play: [{ pitch: 48, quarters: 2 }],
            lengths: [1, 2],
        });
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

        result.current.start({ hand: "both", guideNotes: false });
        // Count-in is one bar (beatMs × beatsPerBar = 250 ms at 240 bpm), then the first
        // tick opens — and paints — the step under the cursor.
        vi.advanceTimersByTime(300);

        expect(markPainted).toHaveBeenCalled();
        result.current.stop();
    });
});
