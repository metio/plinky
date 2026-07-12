// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordedNote } from "../../core/composition";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { useCompositionTransport } from "./useCompositionTransport";

const NOTES: RecordedNote[] = [
    { pitch: 60, startMs: 0, durationMs: 200, velocity: 90 },
    { pitch: 64, startMs: 500, durationMs: 200, velocity: 90 },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function harness(notes: RecordedNote[], onDownbeat = vi.fn()) {
    const audio = fakeAudioEngine();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store: memoryStore(), audio }}>{children}</ServicesProvider>
    );
    const view = renderHook(
        () => useCompositionTransport({ notes, tempo: 120, beatsPerBar: 4, onDownbeat }),
        { wrapper },
    );
    return { ...view, audio, onDownbeat };
}

describe("useCompositionTransport", () => {
    it("replays the take on schedule and flips playing off after the tail", () => {
        const { result, audio } = harness(NOTES);
        act(() => result.current.play());
        expect(result.current.playing).toBe(true);
        act(() => vi.advanceTimersByTime(0));
        expect(audio.strikes.map((strike) => strike.note)).toEqual([60]);
        act(() => vi.advanceTimersByTime(500));
        expect(audio.strikes.map((strike) => strike.note)).toEqual([60, 64]);
        // The playing flag drops 200ms after the last release (tail 700ms + 200).
        act(() => vi.advanceTimersByTime(400));
        expect(result.current.playing).toBe(false);
    });

    it("does nothing on play with an empty take", () => {
        const { result, audio } = harness([]);
        act(() => result.current.play());
        expect(result.current.playing).toBe(false);
        act(() => vi.runAllTimers());
        expect(audio.strikes).toHaveLength(0);
    });

    it("stop cancels every scheduled note", () => {
        const { result, audio } = harness(NOTES);
        act(() => result.current.play());
        act(() => vi.advanceTimersByTime(0));
        act(() => result.current.stop());
        act(() => vi.runAllTimers());
        // Only the first note (already fired) sounded; the rest were cancelled.
        expect(audio.strikes.map((strike) => strike.note)).toEqual([60]);
        expect(result.current.playing).toBe(false);
    });

    it("counts in one bar, then hands the downbeat over exactly once", () => {
        const { result, onDownbeat } = harness([]);
        act(() => result.current.countIn());
        expect(result.current.countingIn).toBe(true);
        // Arming twice must not schedule a second downbeat.
        act(() => result.current.countIn());
        // One 4/4 bar at 120bpm = 2000ms.
        act(() => vi.advanceTimersByTime(1_999));
        expect(onDownbeat).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onDownbeat).toHaveBeenCalledTimes(1);
        expect(result.current.countingIn).toBe(false);
    });

    it("stop cancels a pending count-in before it can fire", () => {
        const { result, onDownbeat } = harness([]);
        act(() => result.current.countIn());
        act(() => result.current.stop());
        expect(result.current.countingIn).toBe(false);
        act(() => vi.runAllTimers());
        expect(onDownbeat).not.toHaveBeenCalled();
    });

    it("cancels everything on unmount", () => {
        const { result, unmount, onDownbeat, audio } = harness(NOTES);
        act(() => result.current.play());
        act(() => result.current.countIn());
        unmount();
        act(() => vi.runAllTimers());
        expect(audio.strikes).toHaveLength(0);
        expect(onDownbeat).not.toHaveBeenCalled();
    });
});
