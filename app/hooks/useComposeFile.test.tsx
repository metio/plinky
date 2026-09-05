// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { toMidiNotes } from "../../core/composition";
import { buildMidiFile } from "../../core/midiFile";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { useComposeFile } from "./useComposeFile";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={{ store: memoryStore() }}>{children}</ServicesProvider>
);

const midiFile = () =>
    new File(
        [
            buildMidiFile(
                toMidiNotes({
                    notes: [
                        { pitch: 62, startMs: 0, durationMs: 400, velocity: 90 },
                        { pitch: 65, startMs: 500, durationMs: 400, velocity: 90 },
                    ],
                    tempo: 120,
                    beatsPerBar: 4,
                }),
                { tempo: 120 },
            ),
        ],
        "take.mid",
        { type: "audio/midi" },
    );

describe("useComposeFile", () => {
    it("loads a MIDI file straight onto an empty canvas", async () => {
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => false, onLoad }), {
            wrapper,
        });
        await act(() => result.current.openFile(midiFile()));
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(onLoad.mock.calls[0]?.[0].notes.map((n: { pitch: number }) => n.pitch)).toEqual([
            62, 65,
        ]);
        expect(result.current.error).toBeNull();
        expect(result.current.pendingReplace).toBe(false);
    });

    it("lets the latest pick win when an earlier one is still being read", async () => {
        // The earlier file's bytes arrive only after the later one has been loaded: it
        // must not come back to park itself over the later pick.
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => false, onLoad }), {
            wrapper,
        });
        const slow = midiFile();
        let release: () => void = () => {};
        const bytes = slow.arrayBuffer.bind(slow);
        Object.defineProperty(slow, "arrayBuffer", {
            value: () =>
                new Promise<ArrayBuffer>((resolve) => {
                    release = () => void bytes().then(resolve);
                }),
        });
        let first: Promise<void> = Promise.resolve();
        act(() => {
            first = result.current.openFile(slow);
        });
        await act(() => result.current.openFile(midiFile()));
        expect(onLoad).toHaveBeenCalledTimes(1);
        await act(async () => {
            release();
            await first;
        });
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(result.current.pendingReplace).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("holds the parsed file for confirmation when work is in progress", async () => {
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => true, onLoad }), {
            wrapper,
        });
        await act(() => result.current.openFile(midiFile()));
        expect(onLoad).not.toHaveBeenCalled();
        expect(result.current.pendingReplace).toBe(true);
        act(() => result.current.confirmReplace());
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(result.current.pendingReplace).toBe(false);
    });

    it("cancelling a pending replace keeps the current take", async () => {
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => true, onLoad }), {
            wrapper,
        });
        await act(() => result.current.openFile(midiFile()));
        act(() => result.current.cancelReplace());
        expect(onLoad).not.toHaveBeenCalled();
        expect(result.current.pendingReplace).toBe(false);
        // A stale confirm after the cancel must not resurrect the held file.
        act(() => result.current.confirmReplace());
        expect(onLoad).not.toHaveBeenCalled();
    });

    it("surfaces an unreadable file as an error, cleared on the next attempt", async () => {
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => false, onLoad }), {
            wrapper,
        });
        const garbage = new File(["not a score"], "junk.xml", { type: "text/xml" });
        await act(() => result.current.openFile(garbage));
        expect(onLoad).not.toHaveBeenCalled();
        expect(result.current.error).toBeTruthy();
        await act(() => result.current.openFile(midiFile()));
        expect(result.current.error).toBeNull();
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it("ignores a missing file (the picker was dismissed)", async () => {
        const onLoad = vi.fn();
        const { result } = renderHook(() => useComposeFile({ hasWork: () => false, onLoad }), {
            wrapper,
        });
        await act(() => result.current.openFile(undefined));
        expect(onLoad).not.toHaveBeenCalled();
        expect(result.current.error).toBeNull();
    });
});
