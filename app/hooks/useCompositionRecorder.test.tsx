// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fakeMidi } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { MidiProvider, useMidiConnection } from "../contexts/midi";
import { ServicesProvider } from "../contexts/services";
import { useCompositionRecorder } from "./useCompositionRecorder";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
        <MidiProvider>{children}</MidiProvider>
    </ServicesProvider>
);

// The recorder under the same MIDI context the page uses, driven through the
// on-screen key press path; `midi` is the injection point for the strikes.
const mount = (options: Parameters<typeof useCompositionRecorder>[0] = {}) =>
    renderHook(
        () => ({
            recorder: useCompositionRecorder(options),
            midi: useMidiConnection(),
        }),
        { wrapper },
    );

const strike = (
    result: {
        current: { midi: { pressKey: (n: number) => void; releaseKey: (n: number) => void } };
    },
    note: number,
) => {
    act(() => {
        result.current.midi.pressKey(note);
        result.current.midi.releaseKey(note);
    });
};

describe("useCompositionRecorder", () => {
    it("records struck notes and reports the first one", () => {
        const onFirstNote = vi.fn();
        const onPitch = vi.fn();
        const { result } = mount({ onFirstNote, onPitch });
        strike(result, 60);
        strike(result, 64);
        expect(result.current.recorder.notes.map((note) => note.pitch)).toEqual([60, 64]);
        expect(onFirstNote).toHaveBeenCalledTimes(1);
        expect(onPitch).toHaveBeenCalledWith(60);
        expect(onPitch).toHaveBeenCalledWith(64);
    });

    it("rewinds to a checkpoint and clears completely", () => {
        const { result } = mount();
        strike(result, 60);
        strike(result, 62);
        act(() => result.current.recorder.setCheckpointNow());
        expect(result.current.recorder.checkpoint).toBe(2);
        strike(result, 64);
        expect(result.current.recorder.notes).toHaveLength(3);
        act(() => result.current.recorder.resetToCheckpoint());
        expect(result.current.recorder.notes.map((note) => note.pitch)).toEqual([60, 62]);
        act(() => result.current.recorder.clear());
        expect(result.current.recorder.notes).toHaveLength(0);
        expect(result.current.recorder.checkpoint).toBeNull();
    });

    it("does nothing on resetToCheckpoint when no checkpoint is set", () => {
        const { result } = mount();
        strike(result, 60);
        act(() => result.current.recorder.resetToCheckpoint());
        expect(result.current.recorder.notes).toHaveLength(1);
    });

    it("loads notes wholesale and drops the checkpoint", () => {
        const { result } = mount();
        strike(result, 60);
        act(() => result.current.recorder.setCheckpointNow());
        act(() =>
            result.current.recorder.load([
                { pitch: 72, startMs: 0, durationMs: 300, velocity: 90 },
            ]),
        );
        expect(result.current.recorder.notes.map((note) => note.pitch)).toEqual([72]);
        expect(result.current.recorder.checkpoint).toBeNull();
    });

    it("counts a loaded take as already-composed work, not a first note", () => {
        const onFirstNote = vi.fn();
        const { result } = mount({ onFirstNote });
        act(() =>
            result.current.recorder.load([
                { pitch: 72, startMs: 0, durationMs: 300, velocity: 90 },
            ]),
        );
        strike(result, 60);
        // The discovery signal marks the player's own first note on an empty
        // canvas; neither loading a share nor extending it counts.
        expect(onFirstNote).not.toHaveBeenCalled();
        expect(result.current.recorder.notes).toHaveLength(2);
    });
});
