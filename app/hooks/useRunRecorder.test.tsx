// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClearedNote } from "../../core/runCapture";
import { useRunRecorder } from "./useRunRecorder";

// One cleared position, as the matcher reports it.
function cleared(ordinal: number, pitch: number, at: number): ClearedNote {
    return {
        pitches: [pitch],
        ordinal,
        timestamp: at,
        timeMs: ordinal * 500,
        velocity: 80,
        wrongBefore: 0,
        staves: [0],
    };
}

function harness(tempo = 100) {
    const ease = vi.fn();
    const view = renderHook(() => useRunRecorder(tempo, ease));
    return { recorder: () => view.result.current, ease, view };
}

describe("useRunRecorder", () => {
    it("holds the run clock shut until the first note lands", () => {
        // Anything gated on the run having started — the ghost's release, the tempo
        // curve — reads this, so a stale start would send the ghost off at Practice.
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 4_000 });
        expect(recorder().startedAt()).toBe(0);

        recorder().cleared(cleared(0, 60, 7_000));
        expect(recorder().startedAt()).toBe(7_000);
    });

    it("times every note from the first one, not from the clock", () => {
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 4_000 });
        recorder().cleared(cleared(0, 60, 7_000));
        recorder().cleared(cleared(1, 62, 7_500));

        expect(recorder().capture.current.notes.map((n) => n.playedMs)).toEqual([0, 500]);
    });

    it("eases the adaptive metronome on every cleared note", () => {
        const { recorder, ease } = harness();
        recorder().begin({ tempo: 90, partial: false, pedalDown: false, at: 0 });
        recorder().cleared(cleared(0, 60, 0));

        expect(ease).toHaveBeenCalledWith(recorder().capture.current, 90);
    });

    it("records a key's real hold length when it lifts", () => {
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
        recorder().cleared(cleared(0, 60, 1_000));
        recorder().released(60, 1_400);

        expect(recorder().capture.current.notes[0]?.heldMs).toBe(400);
    });

    it("seeds a pedal already down when the run begins", () => {
        // Web MIDI streams pedal changes and never the standing state, so a pedal held
        // as Practice is pressed is invisible — and the first notes would record dry
        // despite ringing under the damper.
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: true, at: 2_000 });
        expect(recorder().capture.current.pedalDown).toBe(true);

        recorder().cleared(cleared(0, 60, 3_000));
        // Under the pedal a key-up does not end the note; its hold stays open.
        recorder().released(60, 3_200);
        expect(recorder().capture.current.notes[0]?.heldMs).toBeUndefined();

        recorder().pedal(false, 4_000);
        expect(recorder().capture.current.notes[0]?.heldMs).toBe(1_000);
    });

    it("starts each run from nothing", () => {
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
        recorder().cleared(cleared(0, 60, 1_000));
        recorder().markImprecise();
        expect(recorder().capture.current.notes).toHaveLength(1);

        recorder().begin({ tempo: 120, partial: true, pedalDown: false, at: 9_000 });
        expect(recorder().capture.current.notes).toHaveLength(0);
        expect(recorder().capture.current.imprecise).toBe(false);
        expect(recorder().startedAt()).toBe(0);
        expect(recorder().tempo.current).toBe(120);
        expect(recorder().partial.current).toBe(true);
    });

    it("marks a run played on imprecise input", () => {
        // A computer key or a screen tap carries no true velocity or rhythm, so the run
        // is graded with widened timing windows.
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
        expect(recorder().capture.current.imprecise).toBe(false);
        recorder().markImprecise();
        expect(recorder().capture.current.imprecise).toBe(true);
    });

    it("closes a key still held when the run ends", () => {
        const { recorder } = harness();
        recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
        recorder().cleared(cleared(0, 60, 1_000));
        recorder().flush(1_900);

        expect(recorder().capture.current.notes[0]?.heldMs).toBe(900);
        // Idempotent: a second flush finds nothing open and changes nothing.
        recorder().flush(5_000);
        expect(recorder().capture.current.notes[0]?.heldMs).toBe(900);
    });

    describe("input that arrives out of nowhere", () => {
        // A device reconnecting, or a pedal that was already down when the page loaded,
        // sends events with no matching press. core/runCapture treats them as strays;
        // these pin that the recorder passes them through rather than guarding twice.
        it("shrugs off a release for a pitch it never saw cleared", () => {
            const { recorder } = harness();
            recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
            expect(() => recorder().released(60, 500)).not.toThrow();
            expect(recorder().capture.current.notes).toHaveLength(0);
        });

        it("shrugs off a pedal lift that was holding nothing", () => {
            const { recorder } = harness();
            recorder().begin({ tempo: 100, partial: false, pedalDown: false, at: 0 });
            expect(() => recorder().pedal(false, 500)).not.toThrow();
        });

        it("shrugs off a release arriving before the run has begun", () => {
            const { recorder } = harness();
            expect(() => recorder().released(60, 500)).not.toThrow();
        });
    });

    it("keeps one identity across renders, so callers can depend on it", () => {
        const { recorder, view } = harness();
        const first = recorder();
        view.rerender();
        expect(recorder()).toBe(first);
    });
});
