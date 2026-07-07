// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeepUp } from "./useKeepUp";

// The painting reaches into OSMD's rendered SVG, which only exists in a real
// browser; stub the colour helpers so the hook's paint-tracking is observable in
// jsdom. highlightCursorNotes returns one painted part so a step counts as painted.
vi.mock("../lib/scoreColor", () => ({
    highlightCursorNotes: () => [{ parts: [{ element: {} }], marked: false }],
    paintElement: () => {},
}));

// A minimal cursor over a single note, standing in for the OSMD graphic.
function fakeOsmd() {
    const note = {
        isRest: () => false,
        halfTone: 48,
        ParentStaff: { idInMusicSheet: 0 },
        Length: { RealValue: 0.25 },
    };
    const cursor = {
        reset: () => {},
        show: () => {},
        hide: () => {},
        next: () => {},
        NotesUnderCursor: () => [note],
        iterator: { EndReached: false },
    };
    return { cursor } as unknown as OpenSheetMusicDisplay;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("useKeepUp", () => {
    it("signals markPainted when a run paints a step, so the next run wipes the trail", () => {
        // A keep-up run paints its window and leaves a green/red hit-miss trail but never
        // restores it; only the markPainted signal lets the surface re-render the trail
        // away before the next run. Without it, a stop-then-restart-in-place would leave
        // the prior run's colours on notes the new run has not reached.
        const osmd = fakeOsmd();
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
