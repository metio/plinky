// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    IMPRECISE_HOLD_SCALE,
    KEYBOARD_DEVICE,
    MIC_DEVICE,
    type MidiNoteEvent,
    ON_SCREEN_DEVICE,
} from "../../core/midi";
import { type NoteFunnelOptions, useNoteFunnel } from "./useNoteFunnel";

const PIANO = "Roland FP-30";

function note(device: string, pitch = 60, at = 1_000): MidiNoteEvent {
    return {
        id: 1,
        kind: "noteon",
        note: pitch,
        noteName: "C4",
        velocity: 90,
        channel: 1,
        device,
        timestamp: at,
    };
}

function harness(overrides: Partial<NoteFunnelOptions> = {}) {
    const calls = {
        keepUpActive: vi.fn(() => false),
        registerKeepUp: vi.fn(),
        registerNote: vi.fn(),
        markImprecise: vi.fn(),
        recordRelease: vi.fn(),
        recordPedal: vi.fn(),
        releaseVoice: vi.fn(),
        setPedal: vi.fn(),
    };
    const view = renderHook(() => useNoteFunnel({ ...calls, ...overrides }));
    const on = (device: string, pitch = 60, at = 1_000) =>
        act(() => view.result.current.listener.onNoteOn(note(device, pitch, at)));
    const off = (device: string, pitch = 60, at = 2_000) =>
        act(() => view.result.current.listener.onNoteOff(note(device, pitch, at)));
    return { ...view, calls, on, off, funnel: () => view.result.current };
}

describe("useNoteFunnel", () => {
    describe("a play-along owns the input while it runs", () => {
        it("catches notes against its own clock instead of the matcher", () => {
            const { on, calls } = harness({ keepUpActive: () => true });
            on(PIANO);

            expect(calls.registerKeepUp).toHaveBeenCalledWith(60);
            expect(calls.registerNote).not.toHaveBeenCalled();
            expect(calls.markImprecise).not.toHaveBeenCalled();
        });

        it("holds nothing down, so a run it does not own is not waiting on it", () => {
            const { on, funnel } = harness({ keepUpActive: () => true });
            on(PIANO);
            expect(funnel().holding).toBe(false);
        });
    });

    describe("the microphone is not a keyboard", () => {
        it("never joins the held set, which nothing would ever take it out of", () => {
            // Its note-off is the detector losing the pitch, not a key coming up — so a
            // mic note left in the set would hold full screen open for the session.
            const { on, funnel, calls } = harness();
            on(MIC_DEVICE);

            expect(funnel().holding).toBe(false);
            expect(funnel().isHeld(60)).toBe(false);
            // It still counts as a note played.
            expect(calls.registerNote).toHaveBeenCalledWith(60, 1_000, 90);
        });

        it("is ignored on release: it opened no voice and its timing is noise", () => {
            const { off, calls } = harness();
            off(MIC_DEVICE);

            expect(calls.releaseVoice).not.toHaveBeenCalled();
            expect(calls.recordRelease).not.toHaveBeenCalled();
        });

        it("still widens the run's timing windows", () => {
            const { on, calls } = harness();
            on(MIC_DEVICE);
            expect(calls.markImprecise).toHaveBeenCalled();
        });
    });

    describe("what counts as precise input", () => {
        it("leaves a real instrument's timing alone", () => {
            const { on, calls } = harness();
            on(PIANO);
            expect(calls.markImprecise).not.toHaveBeenCalled();
        });

        it.each([ON_SCREEN_DEVICE, KEYBOARD_DEVICE])("widens the windows for %s", (device) => {
            const { on, calls } = harness();
            on(device);
            expect(calls.markImprecise).toHaveBeenCalled();
        });
    });

    describe("holding keys down", () => {
        it("reports a key that is down, and lets go when it lifts", () => {
            const { on, off, funnel } = harness();
            on(PIANO, 60);
            expect(funnel().holding).toBe(true);
            expect(funnel().isHeld(60)).toBe(true);

            off(PIANO, 60);
            expect(funnel().holding).toBe(false);
            expect(funnel().isHeld(60)).toBe(false);
        });

        it("keeps holding while any other key is still down", () => {
            // The finished run waits on the LAST key, not the first to lift.
            const { on, off, funnel } = harness();
            on(PIANO, 60);
            on(PIANO, 64);
            off(PIANO, 60);

            expect(funnel().holding).toBe(true);
            expect(funnel().isHeld(64)).toBe(true);
            expect(funnel().isHeld(60)).toBe(false);
        });
    });

    describe("releasing a voice", () => {
        it("lets an imprecise tap ring on so a short jab still sounds musical", () => {
            const { off, calls } = harness();
            off(ON_SCREEN_DEVICE, 60);
            expect(calls.releaseVoice).toHaveBeenCalledWith(60, IMPRECISE_HOLD_SCALE);
        });

        it("leaves a real key's articulation exactly as played", () => {
            const { off, calls } = harness();
            off(PIANO, 60);
            expect(calls.releaseVoice).toHaveBeenCalledWith(60, 1);
        });

        it("records the release so the take follows how long you actually held", () => {
            const { off, calls } = harness();
            off(PIANO, 60, 2_400);
            expect(calls.recordRelease).toHaveBeenCalledWith(60, 2_400);
        });
    });

    describe("pedals", () => {
        it("shapes the live sound with every pedal", () => {
            const { result, calls } = harness();
            act(() => result.current.listener.onPedal("soft", true, 100));
            expect(calls.setPedal).toHaveBeenCalledWith("soft", true);
        });

        it("records only the sustain pedal, which is the one the take replays", () => {
            const { result, calls } = harness();
            act(() => result.current.listener.onPedal("sostenuto", true, 100));
            act(() => result.current.listener.onPedal("soft", true, 100));
            expect(calls.recordPedal).not.toHaveBeenCalled();

            act(() => result.current.listener.onPedal("sustain", true, 300));
            expect(calls.recordPedal).toHaveBeenCalledWith(true, 300);
        });

        it("never reaches the matcher — a key press alone decides when a note counts", () => {
            const { result, calls } = harness();
            act(() => result.current.listener.onPedal("sustain", true, 100));
            expect(calls.registerNote).not.toHaveBeenCalled();
        });
    });

    it("keeps one listener identity across renders", () => {
        const { funnel, rerender } = harness();
        const first = funnel().listener;
        rerender();
        expect(funnel().listener).toBe(first);
    });
});
