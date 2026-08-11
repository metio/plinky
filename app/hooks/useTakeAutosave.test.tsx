// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Grade } from "../../core/grade";
import { beginHold, type Take } from "../../core/takes";
import { type RunCapture, startCapture } from "../../core/runCapture";
import { type TakeAutosaveOptions, useTakeAutosave } from "./useTakeAutosave";

const AT = 1_700_000_000_000;
const GRADE = { letter: "A", score: 88 } as Grade;

// A run of cleared notes. `holdOpen` leaves the last note's key still down, which is
// the state the deferred save exists for: its length is not known until it comes up.
function playedRun(count = 4, holdOpen = false): RunCapture {
    const capture = startCapture();
    for (let i = 0; i < count; i++) {
        capture.notes.push({
            targetMs: i * 500,
            playedMs: i * 500,
            wrongBefore: 0,
            velocity: 80,
            pitches: [60 + i],
            staves: [0],
            ...(holdOpen && i === count - 1 ? {} : { heldMs: 400 }),
        });
    }
    if (holdOpen) {
        beginHold(capture.holds, 60 + count - 1, count - 1, (count - 1) * 500);
    }
    return capture;
}

function harness(overrides: Partial<TakeAutosaveOptions> = {}) {
    const saved: Take[] = [];
    const calls = {
        save: vi.fn((take: Take) => {
            saved.push(take);
            return true;
        }),
        onSaved: vi.fn(),
    };
    const options: TakeAutosaveOptions = {
        complete: false,
        holdingNote: false,
        capture: { current: playedRun() },
        tempo: 100,
        beatsPerBar: 4,
        finishedGrade: () => GRADE,
        save: calls.save,
        onSaved: calls.onSaved,
        now: () => 5_000,
        newId: () => "take-1",
        createdAt: () => AT,
        ...overrides,
    };
    const view = renderHook((props: TakeAutosaveOptions) => useTakeAutosave(props), {
        initialProps: options,
    });
    const set = (extra: Partial<TakeAutosaveOptions>) => view.rerender({ ...options, ...extra });
    return { ...view, set, calls, saved, options };
}

describe("useTakeAutosave", () => {
    it("saves nothing while the run is unfinished", () => {
        const { calls } = harness();
        expect(calls.save).not.toHaveBeenCalled();
    });

    it("saves a finished run once the last key is up", () => {
        const { set, saved, calls } = harness();
        set({ complete: true });

        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({
            id: "take-1",
            createdAt: AT,
            letter: "A",
            complete: true,
        });
        expect(saved[0]?.metrics).toBe(GRADE);
        expect(calls.onSaved).toHaveBeenCalledWith(true);
    });

    it("waits for the final note's release rather than saving on the beat", () => {
        // Saving while the key is still down would record the beat the piece ended on
        // instead of how long the note was actually held.
        const { set, calls } = harness({ capture: { current: playedRun(4, true) } });
        set({ complete: true, holdingNote: true });
        expect(calls.save).not.toHaveBeenCalled();

        set({ complete: true, holdingNote: false });
        expect(calls.save).toHaveBeenCalledTimes(1);
    });

    it("saves once however many times it re-renders", () => {
        const { set, calls } = harness();
        set({ complete: true });
        set({ complete: true, tempo: 120 });
        set({ complete: true });
        expect(calls.save).toHaveBeenCalledTimes(1);
    });

    it("keeps an ephemeral run out of the takes list", () => {
        // A daily or a placement drill is graded and shown, but it is not this piece's run.
        const { set, calls } = harness({ ephemeral: true });
        set({ complete: true, ephemeral: true });
        expect(calls.save).not.toHaveBeenCalled();
    });

    describe("the ways out of a run that still owes a take", () => {
        it("saves when the player leaves the surface mid-hold", () => {
            const { set, result, calls } = harness({ capture: { current: playedRun(4, true) } });
            set({ complete: true, holdingNote: true });
            expect(calls.save).not.toHaveBeenCalled();

            // Leaving tears the run down; the take has to be taken first.
            result.current.saveIfOwed();
            expect(calls.save).toHaveBeenCalledTimes(1);
        });

        it("closes the open hold at the moment it is forced to save", () => {
            // The note stopped when the player stopped, so that is its honest length —
            // not a clipped beat, and not left ringing forever.
            const capture = playedRun(4, true);
            const { set, result, saved } = harness({
                capture: { current: capture },
                now: () => 9_000,
            });
            set({ complete: true, holdingNote: true });
            result.current.saveIfOwed();

            expect(capture.holds.size).toBe(0);
            expect(saved[0]?.composition.notes.at(-1)?.durationMs).toBeGreaterThan(0);
        });

        it("does not save twice when the release lands after a forced save", () => {
            const { set, result, calls } = harness({ capture: { current: playedRun(4, true) } });
            set({ complete: true, holdingNote: true });
            result.current.saveIfOwed();
            // The key finally comes up; the deferred path must find nothing owed.
            set({ complete: true, holdingNote: false });
            expect(calls.save).toHaveBeenCalledTimes(1);
        });

        it("owes a fresh take after a reset", () => {
            const { set, result, calls } = harness();
            set({ complete: true });
            expect(calls.save).toHaveBeenCalledTimes(1);

            result.current.reset();
            set({ complete: false });
            set({ complete: true });
            expect(calls.save).toHaveBeenCalledTimes(2);
        });
    });

    it("saves on request whatever the run's state, ungated by the latch", () => {
        // The Save button on the results panel: the player pressed it on purpose.
        const { result, calls, saved } = harness();
        result.current.saveNow(null);
        result.current.saveNow(GRADE);

        expect(calls.save).toHaveBeenCalledTimes(2);
        expect(saved[0]?.letter).toBe("");
        expect(saved[1]?.letter).toBe("A");
    });

    it("writes nothing for a run that cleared no notes", () => {
        const { set, calls } = harness({ capture: { current: startCapture() } });
        set({ complete: true });
        expect(calls.save).not.toHaveBeenCalled();
        expect(calls.onSaved).not.toHaveBeenCalled();
    });

    it("passes a refused write straight through to the surface", () => {
        // The results panel says "saved" only when it really was.
        const { set, calls } = harness({ save: vi.fn(() => false) });
        set({ complete: true });
        expect(calls.onSaved).toHaveBeenCalledWith(false);
    });
});
