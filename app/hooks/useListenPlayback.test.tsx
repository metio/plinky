// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Take } from "../../core/takes";
import { useListenPlayback } from "./useListenPlayback";

// The colour helpers walk real OSMD graphics; stub them so the fake score
// below only has to model the cursor walk itself.
vi.mock("../lib/scoreColor", () => ({
    highlightCursorNotes: vi.fn(() => []),
    restoreNotes: vi.fn(),
    trailNotes: vi.fn(),
}));
vi.mock("../lib/scoreCursor", () => ({
    seekToBar: vi.fn(),
    seekToWhole: vi.fn(),
}));

// A score whose cursor ends after `steps` voice entries, each holding one
// sounding quarter note (halfTone 48 ≈ C4 after the +12 octave shift).
function fakeOsmd(steps: number) {
    let position = 0;
    const cursor = {
        reset: vi.fn(() => {
            position = 0;
        }),
        show: vi.fn(),
        hide: vi.fn(),
        next: vi.fn(() => {
            position++;
        }),
        iterator: {
            get EndReached() {
                return position >= steps;
            },
            get CurrentMeasureIndex() {
                return position;
            },
        },
        NotesUnderCursor: () => [
            {
                Length: { RealValue: 0.25 },
                isRest: () => false,
                halfTone: 48,
            },
        ],
    };
    return { cursor } as unknown as OpenSheetMusicDisplay;
}

const playNote = vi.fn();
const onLap = vi.fn();
let loopState: { on: boolean; from: number; to: number };

function mount(osmd: OpenSheetMusicDisplay | null) {
    return renderHook(() =>
        useListenPlayback({
            getOsmd: () => osmd,
            synth: { playNote },
            tempo: () => 120,
            loop: () => loopState,
            onLap,
            centerCursor: () => {},
            markPainted: () => {},
            isPracticing: () => false,
        }),
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    loopState = { on: false, from: 1, to: 1 };
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe("useListenPlayback", () => {
    it("walks the score, sounding each entry at the tempo, and stops at the end", () => {
        const osmd = fakeOsmd(2);
        const { result } = mount(osmd);

        act(() => result.current.start(0));
        expect(result.current.playing).toBe(true);
        // The first entry sounds immediately, sustained per the 120 BPM tempo.
        expect(playNote).toHaveBeenCalledWith(60, { duration: 0.5 });

        // Each quarter at 120 BPM is 500ms; after both entries the walk ends.
        act(() => void vi.advanceTimersByTime(500));
        expect(playNote).toHaveBeenCalledTimes(2);
        act(() => void vi.advanceTimersByTime(500));
        expect(result.current.playing).toBe(false);
        expect(onLap).toHaveBeenCalledTimes(1);
        expect(osmd.cursor.hide).toHaveBeenCalled();
    });

    it("ignores a second start while one walk owns the cursor", () => {
        const osmd = fakeOsmd(4);
        const { result } = mount(osmd);
        act(() => result.current.start(0));
        const heard = playNote.mock.calls.length;
        act(() => result.current.start(0));
        expect(playNote).toHaveBeenCalledTimes(heard);
    });

    it("laps back to the loop's start bar instead of stopping", () => {
        const osmd = fakeOsmd(1);
        loopState = { on: true, from: 1, to: 1 };
        const { result } = mount(osmd);

        act(() => result.current.start(0));
        // Reaching the end while looping counts a lap and keeps playing.
        act(() => void vi.advanceTimersByTime(500));
        expect(onLap).toHaveBeenCalled();
        expect(result.current.playing).toBe(true);
        act(() => result.current.stop());
    });

    it("replays a take on its own recorded clock and marks it active", () => {
        const osmd = fakeOsmd(10);
        const { result } = mount(osmd);
        const take: Take = {
            id: "t1",
            createdAt: 0,
            letter: "A",
            complete: true,
            metrics: null,
            composition: {
                notes: [
                    { pitch: 60, startMs: 0, durationMs: 400, velocity: 80 },
                    { pitch: 64, startMs: 300, durationMs: 400, velocity: 90 },
                ],
                tempo: 120,
                beatsPerBar: 4,
            },
        };

        act(() => result.current.replay(take));
        expect(result.current.activeReplayId).toBe("t1");
        expect(playNote).toHaveBeenCalledWith(60, { velocity: 80, duration: 0.4 });

        // The second event fires at its recorded offset, then the tail closes.
        act(() => void vi.advanceTimersByTime(300));
        expect(playNote).toHaveBeenCalledWith(64, { velocity: 90, duration: 0.4 });
        act(() => void vi.advanceTimersByTime(500));
        expect(result.current.playing).toBe(false);
        expect(result.current.activeReplayId).toBeNull();
    });

    it("does nothing without a rendered score", () => {
        const { result } = mount(null);
        act(() => result.current.start(0));
        expect(result.current.playing).toBe(false);
        expect(playNote).not.toHaveBeenCalled();
    });
});
