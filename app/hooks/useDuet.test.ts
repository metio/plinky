// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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
//
// Every step carries `elapsedMs` as well as `whole`, because the real model does and
// because it is what decides which of your gaps a note of theirs falls in. A fake that
// left it out put every note in the first gap and passed anyway, which is the whole
// argument for keeping a fake to the shape of the thing it stands in for. At the score's
// own 120 a whole note is two seconds.
const at = (whole: number, pitches: number[]) => ({
    whole,
    elapsedMs: whole * 2000,
    pitches,
    holdQuarters: 1,
});

vi.mock("./useScoreMatcher", () => ({
    collectMatchSteps: (_osmd: OpenSheetMusicDisplay, hand: Hand) =>
        hand === "right" ? [at(0, [60]), at(1, [62])] : [at(0, [48]), at(0.5, [50]), at(1, [52])],
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
    const silenceStrikes = vi.fn();
    const { scheduler, pendingCount, fire } = fakeScheduler();
    const view = renderHook(() =>
        useDuet({
            getOsmd: () => osmd,
            synth: { playNote, silenceStrikes },
            scheduler,
            enabled,
            hand,
        }),
    );
    return { playNote, silenceStrikes, scheduler, pendingCount, fire, ...view };
}

// Every owner the duet struck a note under.
const ownersOf = (playNote: ReturnType<typeof vi.fn>) =>
    new Set(playNote.mock.calls.map(([, options]) => (options as { owner?: symbol }).owner));

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

describe("stopping the duet", () => {
    it("strikes every note of the other hand under one owner of its own", () => {
        const { result, playNote, fire } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        fire();
        const owners = ownersOf(playNote);
        expect(playNote).toHaveBeenCalledTimes(2);
        expect(owners.size).toBe(1);
        expect(typeof [...owners][0]).toBe("symbol");
    });

    it("plays nothing it had scheduled once the run is stopped", () => {
        const { result, playNote, pendingCount, fire } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        expect(pendingCount()).toBe(1);
        result.current.stop();
        expect(pendingCount()).toBe(0);
        fire();
        // Only the note that sounded with yours, before the stop.
        expect(playNote).toHaveBeenCalledTimes(1);
    });

    it("takes back the note already sounding, under the owner it was struck with", () => {
        const { result, playNote, silenceStrikes } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        const [owner] = ownersOf(playNote);
        result.current.stop();
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("takes back the last run's notes when the next one is primed", () => {
        const { result, playNote, silenceStrikes, pendingCount } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        const [owner] = ownersOf(playNote);
        result.current.prime();
        expect(pendingCount()).toBe(0);
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("leaves the notes alone while the run goes on", () => {
        const { result, silenceStrikes } = setup();
        result.current.prime();
        // Priming takes back whatever a previous run left; the run starts from here.
        silenceStrikes.mockClear();
        result.current.onCleared(0, 120);
        // Your next note re-locks the gap: the pending notes are rescheduled, but the one
        // still ringing is the music, not something to take back.
        result.current.onCleared(1, 120);
        expect(silenceStrikes).not.toHaveBeenCalled();
    });

    it("gives each duet its own owner, so one's stop leaves the other's notes", () => {
        const first = setup();
        const second = setup();
        first.result.current.prime();
        first.result.current.onCleared(0, 120);
        second.result.current.prime();
        second.result.current.onCleared(0, 120);
        const [firstOwner] = ownersOf(first.playNote);
        const [secondOwner] = ownersOf(second.playNote);
        expect(firstOwner).not.toBe(secondOwner);
        second.silenceStrikes.mockClear();
        first.result.current.stop();
        expect(second.silenceStrikes).not.toHaveBeenCalled();
    });

    it("stops like any other interruption when the page leaves", () => {
        const { result, playNote, silenceStrikes, pendingCount, unmount } = setup();
        result.current.prime();
        result.current.onCleared(0, 120);
        const [owner] = ownersOf(playNote);
        silenceStrikes.mockClear();
        unmount();
        expect(pendingCount()).toBe(0);
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("stops like any other interruption when it is turned off mid-run", () => {
        const playNote = vi.fn();
        const silenceStrikes = vi.fn();
        const { scheduler, pendingCount } = fakeScheduler();
        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) =>
                useDuet({
                    getOsmd: () => osmd,
                    synth: { playNote, silenceStrikes },
                    scheduler,
                    enabled,
                    hand: "right",
                }),
            { initialProps: { enabled: true } },
        );
        result.current.prime();
        result.current.onCleared(0, 120);
        const [owner] = ownersOf(playNote);
        silenceStrikes.mockClear();
        rerender({ enabled: false });
        expect(pendingCount()).toBe(0);
        expect(silenceStrikes).toHaveBeenCalledWith(owner);
    });

    it("is safe to stop before anything was scheduled", () => {
        const { result, silenceStrikes } = setup();
        expect(() => result.current.stop()).not.toThrow();
        expect(silenceStrikes).toHaveBeenCalledTimes(1);
    });
});
