// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Grade } from "../../core/grade";
import { type RunCapture, startCapture } from "../../core/runCapture";
import { beginHold } from "../../core/takes";
import { memoryStore } from "../adapters/memoryStore";
import { type AppServices, createServices } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useRunGrading, type RunGradingOptions } from "./useRunGrading";

const SONG = "gymnopedie";
// A run finishing on the wall clock the store stamps it with.
const AT = 1_700_000_000_000;

// A run of `count` cleared notes, one per beat, played dead on the notated time —
// the shape the matcher hands over when a piece is read cleanly at tempo.
function playedRun(count: number, beatMs = 500): RunCapture {
    const capture = startCapture();
    for (let i = 0; i < count; i++) {
        capture.notes.push({
            targetMs: i * beatMs,
            playedMs: i * beatMs,
            wrongBefore: 0,
            velocity: 80,
            pitches: [60 + i],
            staves: [0],
        });
    }
    return capture;
}

function harness(overrides: Partial<RunGradingOptions> = {}, services?: Partial<AppServices>) {
    const store = memoryStore();
    const resolved = createServices({
        store,
        activity: createActivitySignal(),
        scheduler: fakeScheduler(10_000),
        ...services,
    });
    const calls = {
        recordResult: vi.fn(),
        playNote: vi.fn(),
        bumpTempo: vi.fn(),
        adoptOwnRun: vi.fn(),
        publishMilestone: vi.fn(),
        onGraded: vi.fn(),
        onRunComplete: vi.fn(),
    };
    const options: RunGradingOptions = {
        complete: false,
        holdingNote: false,
        correct: 8,
        wrong: 0,
        capture: { current: playedRun(8) },
        runTempo: { current: 100 },
        intendedTempo: 100,
        partial: { current: false },
        id: SONG,
        title: "Gymnopédie",
        looped: false,
        sightReading: false,
        atTempo: false,
        services: resolved,
        playNote: calls.playNote,
        publishMilestone: calls.publishMilestone,
        recordResult: calls.recordResult,
        bumpTempo: calls.bumpTempo,
        adoptOwnRun: calls.adoptOwnRun,
        onGraded: calls.onGraded,
        onRunComplete: calls.onRunComplete,
        now: () => AT,
        ...overrides,
    };
    const view = renderHook((props: RunGradingOptions) => useRunGrading(props), {
        initialProps: options,
    });
    // Finishing the run is the whole trigger: re-render with `complete` true.
    const finish = (extra: Partial<RunGradingOptions> = {}) =>
        view.rerender({ ...options, ...extra, complete: true });
    return { ...view, finish, calls, store, services: resolved, options };
}

describe("useRunGrading", () => {
    it("does nothing until the run is complete", () => {
        const { calls, result } = harness();
        expect(calls.recordResult).not.toHaveBeenCalled();
        expect(result.current.fromRun()).toBe(false);
        expect(result.current.finishedGrade()).toBeNull();
    });

    it("scores a finished run and announces it once", () => {
        const { finish, calls, result } = harness();
        finish();

        expect(calls.recordResult).toHaveBeenCalledTimes(1);
        const grade = result.current.finishedGrade() as Grade;
        expect(grade).not.toBeNull();
        // Read dead on the notated time with nothing wrong: the top of the ladder.
        expect(grade.letter).toBe("S");
        expect(result.current.fromRun()).toBe(true);
        expect(calls.onGraded).toHaveBeenCalledWith(grade);
        expect(calls.onRunComplete).toHaveBeenCalledTimes(1);
        expect(calls.bumpTempo).toHaveBeenCalledTimes(1);
        // The finishing flourish sounds.
        expect(calls.playNote).toHaveBeenCalled();
    });

    it("grades one run exactly once, however often it re-renders", () => {
        // The latch is what stops a run being counted twice into history, mastery and
        // the lifetime fingerprint when a parent re-creates a callback mid-completion.
        const { finish, calls } = harness();
        finish();
        finish({ onRunComplete: vi.fn() });
        finish();

        expect(calls.recordResult).toHaveBeenCalledTimes(1);
        expect(calls.onRunComplete).toHaveBeenCalledTimes(1);
        expect(calls.bumpTempo).toHaveBeenCalledTimes(1);
    });

    it("scores the next run after a reset", () => {
        const { finish, calls, result, rerender, options } = harness();
        finish();
        result.current.reset();
        expect(result.current.fromRun()).toBe(false);
        expect(result.current.finishedGrade()).toBeNull();

        rerender({ ...options, complete: false });
        finish();
        expect(calls.recordResult).toHaveBeenCalledTimes(2);
    });

    it("holds an ephemeral run back from the completion callback", () => {
        // A daily or a placement drill is played, graded and shown — but it is not the
        // piece's own run, so the surface that owns the piece is not told.
        const { finish, calls } = harness({ ephemeral: true });
        finish();

        expect(calls.recordResult).toHaveBeenCalledTimes(1);
        expect(calls.onGraded).toHaveBeenCalledTimes(1);
        expect(calls.onRunComplete).not.toHaveBeenCalled();
    });

    it("records a sight-read only for a full run of a new piece", () => {
        const { finish, services } = harness({ sightReading: true, atTempo: true });
        finish();

        expect(services.sightReads.load(SONG)).toMatchObject({ atTempo: true, playedAt: AT });
    });

    it("keeps a run taken over from Listen out of the sight-reading record", () => {
        // Half the piece was read aloud to the player first, so it measures nothing.
        const { finish, services } = harness({
            sightReading: true,
            partial: { current: true },
        });
        finish();

        expect(services.sightReads.load(SONG)).toBeNull();
    });

    it("carries the practice tempo into the share grid but not the grade", () => {
        // The two scorings part company on purpose: the practice grade forgives a slow,
        // careful run so practising stays encouraging, while the shared grid rewards
        // playing at the piece's own tempo, which a crawl cannot fake.
        const atTempo = harness({ runTempo: { current: 100 }, intendedTempo: 100 });
        atTempo.finish();
        const slow = harness({ runTempo: { current: 50 }, intendedTempo: 100 });
        slow.finish();

        const gradeOf = (h: ReturnType<typeof harness>) =>
            (h.result.current.finishedGrade() as Grade).score;
        const gridOf = (h: ReturnType<typeof harness>) =>
            JSON.stringify(h.calls.recordResult.mock.calls[0]?.[0]?.grid);

        expect(gradeOf(slow)).toBe(gradeOf(atTempo));
        expect(gridOf(slow)).not.toBe(gridOf(atTempo));
    });

    it("survives a run that cleared nothing", () => {
        const { finish, calls, result } = harness({
            capture: { current: startCapture() },
            correct: 0,
        });
        expect(() => finish()).not.toThrow();
        expect(calls.recordResult).toHaveBeenCalledTimes(1);
        expect(result.current.finishedGrade()).not.toBeNull();
    });
});

describe("waiting for the keys to come up", () => {
    it("does not grade while a key is still down", () => {
        // The run is matched but the player is still holding the final chord. Grading
        // now would read that note as having no length at all.
        const { finish, calls } = harness();
        finish({ holdingNote: true });
        expect(calls.recordResult).not.toHaveBeenCalled();
    });

    it("grades the moment the last key comes up", () => {
        const { finish, rerender, options, calls } = harness();
        finish({ holdingNote: true });
        rerender({ ...options, complete: true, holdingNote: false });
        expect(calls.recordResult).toHaveBeenCalledTimes(1);
    });

    it("closes the final note's hold, so no played note is lost", () => {
        // The whole point: the last note's length is only known once its key is up, and
        // the expressive reading is judged on exactly that.
        const capture = playedRun(6);
        beginHold(capture.holds, 65, capture.notes.length - 1, 0);
        const { finish, rerender, options } = harness({ capture: { current: capture } });
        finish({ holdingNote: true });
        expect(capture.notes.at(-1)?.heldMs).toBeUndefined();

        rerender({ ...options, capture: { current: capture }, complete: true, holdingNote: false });
        expect(capture.notes.at(-1)?.heldMs).toBeGreaterThan(0);
        expect(capture.holds.size).toBe(0);
    });

    it("still grades a run whose last chord was never released, on the way out", () => {
        // A player who finishes and walks away with a key down must not lose the run.
        const { finish, result, calls } = harness();
        finish({ holdingNote: true });
        expect(calls.recordResult).not.toHaveBeenCalled();

        result.current.gradeIfOwed();
        expect(calls.recordResult).toHaveBeenCalledTimes(1);
    });

    it("grades once even if both the key-up and the teardown ask", () => {
        const { finish, result, calls } = harness();
        finish();
        result.current.gradeIfOwed();
        expect(calls.recordResult).toHaveBeenCalledTimes(1);
    });
});
