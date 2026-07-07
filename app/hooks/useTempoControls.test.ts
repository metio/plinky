// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunCapture } from "../../core/runCapture";
import { useTempoControls } from "./useTempoControls";

// A capture whose last two notes are notated `notatedMs` apart but played `actualMs`
// apart, so the eased live tempo reads the pace from that ratio (a shorter played gap
// than notated means the player is running ahead, so the tempo eases upward).
const captureGap = (notatedMs: number, actualMs: number): RunCapture =>
    ({
        notes: [
            { targetMs: 0, playedMs: 0 },
            { targetMs: notatedMs, playedMs: actualMs },
        ],
    }) as unknown as RunCapture;

describe("useTempoControls", () => {
    it("seeds the slider and live tempo from the piece's tempo", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 96 }));
        expect(result.current.tempo).toBe(96);
        expect(result.current.liveTempo).toBe(96);
        expect(result.current.readTempo()).toBe(96);
    });

    it("reads the live slider tempo through readTempo without a re-render", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 100 }));
        act(() => result.current.setTempo(132));
        expect(result.current.readTempo()).toBe(132);
    });

    it("bumps the tempo one step toward the target only while the trainer is on", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 100 }));
        act(() => result.current.bumpTempo());
        expect(result.current.tempo).toBe(100);
        act(() => {
            result.current.setTrainerOn(true);
            result.current.setTrainerTarget(108);
        });
        act(() => result.current.bumpTempo());
        expect(result.current.tempo).toBe(105);
        // Never past the target.
        act(() => result.current.bumpTempo());
        expect(result.current.tempo).toBe(108);
    });

    it("resyncs the live tempo back to the current slider tempo", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 100 }));
        act(() => result.current.easeToward(captureGap(400, 200), 100));
        const drifted = result.current.liveTempo;
        expect(drifted).not.toBe(100);
        act(() => result.current.setTempo(120));
        act(() => result.current.resyncLive());
        expect(result.current.liveTempo).toBe(120);
    });

    it("eases the live tempo toward the pace read from the capture's last gap", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 100 }));
        // Played 200 ms against a notated 400 ms gap — running at twice the pace, so the
        // live tempo eases up from the 100 bpm start.
        act(() => result.current.easeToward(captureGap(400, 200), 100));
        expect(result.current.liveTempo).toBeGreaterThan(100);
    });

    it("holds the metronome toggles independently", () => {
        const { result } = renderHook(() => useTempoControls({ initialTempo: 100 }));
        act(() => {
            result.current.setMetronomeOn(true);
            result.current.setSubdivision(3);
            result.current.setAdaptive(true);
        });
        expect(result.current.metronomeOn).toBe(true);
        expect(result.current.subdivision).toBe(3);
        expect(result.current.adaptive).toBe(true);
    });
});
