// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hand } from "../../core/matcher";
import type { Scheduler } from "../ports/scheduler";
import { useDuet } from "./useDuet";

// The hook lifts both hands off the score through collectMatchSteps; mock it so a
// test hands the run a fixed two-hand shape without an engraved OSMD. The right
// hand plays on whole 0 and 1; the left hand plays with it on 0, halfway through the
// gap on 0.5, and again on 1.
vi.mock("./useScoreMatcher", () => ({
    collectMatchSteps: (_osmd: OpenSheetMusicDisplay, hand: Hand) =>
        hand === "right"
            ? [
                  { whole: 0, pitches: [60], holdQuarters: 1 },
                  { whole: 1, pitches: [62], holdQuarters: 1 },
              ]
            : [
                  { whole: 0, pitches: [48], holdQuarters: 1 },
                  { whole: 0.5, pitches: [50], holdQuarters: 1 },
                  { whole: 1, pitches: [52], holdQuarters: 1 },
              ],
}));

// A hand-driven scheduler: after() records the pending run and hands back an id;
// cancel() drops it; fire() runs everything still pending, newest-registered last.
function fakeScheduler() {
    const pending = new Map<number, () => void>();
    let seq = 0;
    const scheduler = {
        after: vi.fn((_ms: number, run: () => void) => {
            const id = ++seq;
            pending.set(id, run);
            return id;
        }),
        cancel: vi.fn((id: number) => pending.delete(id)),
        every: vi.fn(),
        frame: vi.fn(),
        cancelFrame: vi.fn(),
        now: () => 0,
    } as unknown as Scheduler & { after: ReturnType<typeof vi.fn> };
    return {
        scheduler,
        pendingCount: () => pending.size,
        fire: () => {
            for (const run of [...pending.values()]) {
                run();
            }
            pending.clear();
        },
    };
}

const osmd = {} as OpenSheetMusicDisplay;

function setup(enabled = true, hand: Hand = "right") {
    const playNote = vi.fn();
    const { scheduler, pendingCount, fire } = fakeScheduler();
    const view = renderHook(() =>
        useDuet({ getOsmd: () => osmd, playNote, scheduler, enabled, hand }),
    );
    return { playNote, scheduler, pendingCount, fire, ...view };
}

beforeEach(() => vi.clearAllMocks());

describe("useDuet", () => {
    it("sounds the other hand's note that lands with yours, at once", () => {
        const { result, playNote } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        expect(playNote).toHaveBeenCalledWith(48, expect.objectContaining({ duration: 0.5 }));
    });

    it("schedules a between-note of the other hand at your live tempo", () => {
        const { result, scheduler, playNote } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        // 0.5 whole into the gap at 120 BPM → 1000 ms.
        expect(scheduler.after).toHaveBeenCalledWith(1000, expect.any(Function));
        const scheduled = scheduler.after.mock.calls[0]?.[1] as () => void;
        scheduled();
        expect(playNote).toHaveBeenCalledWith(50, expect.anything());
    });

    it("re-locks on your next note, cancelling the previous gap's stragglers", () => {
        const { result, scheduler, pendingCount } = setup();
        result.current.prime();
        result.current.onCleared(0, 120); // schedules the 0.5 straggler
        expect(pendingCount()).toBe(1);
        result.current.onCleared(1, 120); // your next note re-locks
        expect(scheduler.cancel).toHaveBeenCalled();
        expect(pendingCount()).toBe(0);
    });

    it("plays the other hand's final note on your last note (no upper bound)", () => {
        const { result, playNote } = setup();
        result.current.prime();
        result.current.onCleared(1, 120);
        expect(playNote).toHaveBeenCalledWith(52, expect.anything());
    });

    it("stays silent when the duet is off", () => {
        const { result, playNote, scheduler } = setup(false);
        result.current.prime();
        result.current.onCleared(0, 120);
        expect(playNote).not.toHaveBeenCalled();
        expect(scheduler.after).not.toHaveBeenCalled();
    });

    it("does nothing for a both-hands run", () => {
        const { result, playNote } = setup(true, "both");
        result.current.prime();
        result.current.onCleared(0, 120);
        expect(playNote).not.toHaveBeenCalled();
    });

    it("ignores a note index past the run's end", () => {
        const { result, playNote } = setup();
        result.current.prime();
        result.current.onCleared(9, 120);
        expect(playNote).not.toHaveBeenCalled();
    });
});
