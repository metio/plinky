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
import { fakePersistence } from "../testing/fakePersistence";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useRunGrading, type RunGradingOptions } from "./useRunGrading";

const SONG = "gymnopedie";
// A run finishing on the wall clock the store stamps it with.
const AT = 1_700_000_000_000;

// A run of eight cleared notes, one per beat, with per-note deviations — a wrong key
// before the hit, an offset from the notated time, which hand played it. The default is a
// clean run read dead on the beat.
function run(
    shape: (index: number) => { wrongBefore?: number; offsetMs?: number; staff?: number },
    count = 8,
    beatMs = 500,
): RunCapture {
    const capture = startCapture();
    for (let i = 0; i < count; i++) {
        const { wrongBefore = 0, offsetMs = 0, staff = 0 } = shape(i);
        capture.notes.push({
            targetMs: i * beatMs,
            playedMs: i * beatMs + offsetMs,
            wrongBefore,
            velocity: 80,
            pitches: [60 + i],
            staves: [staff],
        });
    }
    return capture;
}

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
        reportProgressSaved: vi.fn(),
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
        reportProgressSaved: calls.reportProgressSaved,
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

    describe("keeping the device's progress", () => {
        it("asks the browser to keep the data once a run has been recorded", () => {
            // Held until there is progress worth keeping: the browsers that decide this
            // silently weigh how much the player has used the site, and asking on a
            // first page view is the request most likely to be refused.
            const persistence = fakePersistence();
            const h = harness({}, { persistence });

            expect(persistence.asked).toBe(0);

            h.finish();

            expect(persistence.asked).toBe(1);
        });

        it("asks once a session, not once a run", () => {
            // The adapter short-circuits on an existing grant, and there is no point
            // re-asking a player who declined.
            const persistence = fakePersistence();
            const h = harness({}, { persistence });

            h.finish();
            h.finish();

            expect(persistence.asked).toBe(1);
        });

        it("records the run even when the browser refuses to keep it", () => {
            // The two are independent: a refused grant means the data is evictable
            // later, not that this run failed to write now.
            const persistence = fakePersistence(false);
            const h = harness({}, { persistence });

            h.finish();

            expect(h.calls.reportProgressSaved).toHaveBeenCalledWith(true);
        });
    });

    describe("the numbers the panel is handed", () => {
        // Every accuracy figure in the integration tests is seeded — the panel is given
        // { accuracy: 90 } and asked whether it renders it. That leaves the wire from a
        // played run to a graded one asserted by nothing, and the failures it would let
        // through are the worst kind: an off-by-one in the step index or a crossed metric
        // yields a plausible wrong number with every test green.
        //
        // The figures below were measured from the grader rather than assumed. One of
        // them corrected an assumption on the way: a run played uniformly late scores
        // timing 100, because timing is read against the player's own drift and playing
        // evenly behind the beat is even playing.
        const graded = (h: ReturnType<typeof harness>) =>
            h.calls.recordResult.mock.calls[0]?.[0]?.grade;

        it("grades a clean run at the top of every reading", () => {
            const h = harness();
            h.finish({ capture: { current: playedRun(8) } });

            expect(graded(h)).toMatchObject({ accuracy: 100, timing: 100, flow: 100, letter: "S" });
        });

        it("charges a wrong key to accuracy and flow, and leaves timing alone", () => {
            // The crossed-metric case: a swap between accuracy and timing reads as a
            // plausible number either way.
            //
            // Accuracy comes from the run's own wrong-key counter, while the per-note
            // wrongBefore feeds flow — two separate paths into one panel, which is
            // exactly the kind of wire that had nothing asserting it. Both are set here,
            // as a real run sets them.
            const h = harness();
            h.finish({
                wrong: 1,
                capture: { current: run((i) => ({ wrongBefore: i === 3 ? 1 : 0 })) },
            });

            expect(graded(h)).toMatchObject({ accuracy: 89, timing: 100, flow: 88, letter: "A" });
        });

        it("leaves accuracy alone when the playing is uneven", () => {
            // The mirror of the case above: ragged timing must not read as wrong notes.
            const jitter = [0, 180, -160, 200, -190, 170, -150, 190];
            const h = harness();
            h.finish({ capture: { current: run((i) => ({ offsetMs: jitter[i] ?? 0 })) } });

            expect(graded(h)).toMatchObject({ accuracy: 100, timing: 25, letter: "B" });
        });

        it("does not punish a run that is late but even", () => {
            // Timing is read against the player's own drift, so playing consistently
            // behind the beat is playing evenly. Asserted because it is surprising, and
            // because a change that "fixed" it would be a regression.
            const h = harness();
            h.finish({ capture: { current: run(() => ({ offsetMs: 220 })) } });

            expect(graded(h)).toMatchObject({ accuracy: 100, timing: 100, letter: "S" });
        });

        it("hears one hand dragging behind the other", () => {
            // The hand-attribution case. Swapping the staves would still produce a
            // plausible figure, so the run is built with the left hand alone dragging.
            const h = harness();
            h.finish({
                capture: {
                    current: run((i) =>
                        i % 2 === 1 ? { offsetMs: 260, staff: 1 } : { offsetMs: 0, staff: 0 },
                    ),
                },
            });

            expect(graded(h)).toMatchObject({ accuracy: 100, timing: 63 });
        });
    });
});
