// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MidiProvider, useMidiConnection } from "./midi";

type Input = {
    id: string;
    name: string;
    manufacturer: string;
    state: string;
    onmidimessage: ((event: { data: Uint8Array; timeStamp: number }) => void) | null;
};

function fakeInput(): Input {
    return {
        id: "in-1",
        name: "Test Piano",
        manufacturer: "Acme",
        state: "connected",
        onmidimessage: null,
    };
}

function setRequestMidiAccess(implementation: () => Promise<unknown>) {
    (navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess =
        vi.fn(implementation);
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MidiProvider>{children}</MidiProvider>
);

beforeEach(() => {
    setRequestMidiAccess(() => Promise.resolve({ inputs: new Map(), onstatechange: null }));
});

afterEach(() => {
    cleanup();
    (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess = undefined;
});

describe("MidiProvider", () => {
    it("connects, lists devices, and wires the input handler", async () => {
        const input = fakeInput();
        setRequestMidiAccess(() =>
            Promise.resolve({ inputs: new Map([["in-1", input]]), onstatechange: null }),
        );
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        expect(result.current.support).toBe("supported");

        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.status).toBe("ready");
        expect(result.current.devices[0]?.name).toBe("Test Piano");

        // Devices get a message handler; a note-on flows through to held notes.
        expect(typeof input.onmidimessage).toBe("function");
        act(() => input.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]), timeStamp: 0 }));
        expect(result.current.heldNotes).toContain(60);
    });

    it("reports a denied request", async () => {
        setRequestMidiAccess(() => Promise.reject(new Error("denied")));
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.status).toBe("denied");
    });

    it("plays from the computer keyboard and shifts the octave", () => {
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })));
        expect(result.current.heldNotes).toContain(60);
        act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "a" })));
        expect(result.current.heldNotes).not.toContain(60);

        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" })));
        expect(result.current.octaveOffset).toBe(1);
    });

    it("releases keys still held when the window loses focus", () => {
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })));
        expect(result.current.heldNotes).toContain(60);
        // The keyup would otherwise be delivered to whatever window took focus,
        // leaving the note stuck; blur must clear it.
        act(() => window.dispatchEvent(new Event("blur")));
        expect(result.current.heldNotes).not.toContain(60);
    });

    it("releases an on-screen-keyboard note still held on blur", () => {
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        // A pointer held on an on-screen key, then an OS app-switch, never delivers
        // pointerup; blur must release it too — not just computer-keyboard keys.
        act(() => result.current.pressKey(67));
        expect(result.current.heldNotes).toContain(67);
        act(() => window.dispatchEvent(new Event("blur")));
        expect(result.current.heldNotes).not.toContain(67);
    });

    it("plays from the on-screen keyboard bridge, notifies subscribers, and clears events", () => {
        const { result } = renderHook(() => useMidiConnection(), { wrapper });
        const onNoteOn = vi.fn();
        let unsubscribe = () => {};
        act(() => {
            unsubscribe = result.current.subscribe({ onNoteOn });
        });

        act(() => result.current.pressKey(64));
        expect(result.current.heldNotes).toContain(64);
        expect(onNoteOn).toHaveBeenCalled();
        expect(result.current.events.length).toBeGreaterThan(0);

        act(() => result.current.releaseKey(64));
        expect(result.current.heldNotes).not.toContain(64);

        act(() => result.current.clearEvents());
        expect(result.current.events).toEqual([]);
        act(() => unsubscribe());
    });
});
