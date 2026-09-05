// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

// Step entry: the same keys, writing notes of a stated length at the next position
// instead of timing what the hands did.
describe("useCompositionRecorder in step entry", () => {
    const QUARTER = 500; // a quarter at 120bpm

    it("writes the length asked for, not the length the key was held", () => {
        // The whole reason step entry exists: a player who knows the tune and cannot play
        // it up to speed should not have their hesitation written down as the rhythm.
        const { result } = mount({ stepMs: QUARTER });
        strike(result, 60);
        strike(result, 62);

        expect(result.current.recorder.notes).toEqual([
            { pitch: 60, startMs: 0, durationMs: 500, velocity: expect.any(Number) },
            { pitch: 62, startMs: 500, durationMs: 500, velocity: expect.any(Number) },
        ]);
    });

    it("counts a stepped note as the first one the moment it is written", () => {
        // A played note is not a note until it is let go; a stepped one is complete when
        // it is placed, so the "has composed something" signal must not wait for a release
        // that carries no meaning here.
        const onFirstNote = vi.fn();
        const { result } = mount({ stepMs: QUARTER, onFirstNote });
        act(() => result.current.midi.pressKey(60));
        expect(onFirstNote).toHaveBeenCalledTimes(1);
        act(() => result.current.midi.releaseKey(60));
        expect(onFirstNote).toHaveBeenCalledTimes(1);
    });

    it("makes one step of keys pressed together", () => {
        const { result } = mount({ stepMs: QUARTER });
        act(() => {
            result.current.midi.pressKey(60);
            result.current.midi.pressKey(64);
            result.current.midi.pressKey(67);
        });
        act(() => {
            result.current.midi.releaseKey(60);
            result.current.midi.releaseKey(64);
            result.current.midi.releaseKey(67);
        });
        strike(result, 72);

        const notes = result.current.recorder.notes;
        expect(notes.slice(0, 3).map((n) => n.startMs)).toEqual([0, 0, 0]);
        expect(notes[3]).toMatchObject({ pitch: 72, startMs: 500 });
    });

    it("leaves a gap for a rest and takes a step back", () => {
        const { result } = mount({ stepMs: QUARTER });
        strike(result, 60);
        act(() => result.current.recorder.rest());
        strike(result, 62);
        expect(result.current.recorder.notes[1]).toMatchObject({ startMs: 1000 });

        act(() => result.current.recorder.back());
        expect(result.current.recorder.notes.map((n) => n.pitch)).toEqual([60]);
        strike(result, 64);
        // Back to where the removed note stood, gap and all.
        expect(result.current.recorder.notes[1]).toMatchObject({ pitch: 64, startMs: 1000 });
    });

    it("carries the take across when the mode changes mid-piece", () => {
        // Somebody improvises a phrase, then wants to finish it a note at a time. What is
        // already there must survive, and the next step must land after it rather than on
        // top of it.
        const { result, rerender } = renderHook(
            ({ stepMs }: { stepMs: number | null }) => ({
                recorder: useCompositionRecorder({ stepMs }),
                midi: useMidiConnection(),
            }),
            { wrapper, initialProps: { stepMs: null as number | null } },
        );
        strike(result, 60);
        const played = result.current.recorder.notes.length;
        expect(played).toBe(1);

        rerender({ stepMs: QUARTER });
        strike(result, 64);
        const notes = result.current.recorder.notes;
        expect(notes).toHaveLength(2);
        const first = notes[0]!;
        expect(notes[1]!.startMs).toBeGreaterThanOrEqual(first.startMs + first.durationMs);
    });

    it("writes a key held across the switch into step entry as one step", () => {
        // The press lives only in the live state's open map, and the step side has no
        // hold to close: without this the note that was audibly played never appears.
        const view = renderHook(
            ({ stepMs }: { stepMs: number | null }) => ({
                recorder: useCompositionRecorder({ stepMs }),
                midi: useMidiConnection(),
            }),
            { wrapper, initialProps: { stepMs: null as number | null } },
        );
        act(() => {
            view.result.current.midi.pressKey(64);
        });
        expect(view.result.current.recorder.notes).toHaveLength(0);
        view.rerender({ stepMs: 500 });
        expect(view.result.current.recorder.notes).toEqual([
            { pitch: 64, startMs: 0, durationMs: 500, velocity: expect.any(Number) },
        ]);
        act(() => {
            view.result.current.midi.releaseKey(64);
        });
        expect(view.result.current.recorder.notes).toHaveLength(1);
    });

    it("clears both ways of writing at once", () => {
        const { result } = mount({ stepMs: QUARTER });
        strike(result, 60);
        act(() => result.current.recorder.clear());
        expect(result.current.recorder.notes).toEqual([]);
        strike(result, 62);
        // The next note starts a fresh take at the beginning, not after the cleared one.
        expect(result.current.recorder.notes[0]).toMatchObject({ startMs: 0 });
    });
});
