// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FakeMidi, fakeMidi, fakeMidiInput } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "./services";
import { MidiProvider, useMidiConnection } from "./midi";

// The provider takes its MIDI seam injected, so the whole flow — support probe,
// permission resume, request, hot-plug, messages — runs against the fake with
// no navigator stubbing.
const wrapperWith = (midi: FakeMidi) => {
    // A fresh memory store too, so the keymap/prefs reads stay isolated per test.
    const store = memoryStore();
    return ({ children }: { children: React.ReactNode }) => (
        <ServicesProvider services={{ midi, store }}>
            <MidiProvider>{children}</MidiProvider>
        </ServicesProvider>
    );
};

afterEach(cleanup);

describe("MidiProvider", () => {
    it("connects, lists devices, and wires the input handler", async () => {
        const input = fakeMidiInput({ id: "in-1", name: "Test Piano", manufacturer: "Acme" });
        const midi = fakeMidi({ inputs: [input] });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        expect(result.current.support).toBe("supported");

        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.status).toBe("ready");
        expect(result.current.devices[0]?.name).toBe("Test Piano");

        // Devices get a message handler; a note-on flows through to held notes.
        act(() => input.emit([0x90, 60, 100]));
        expect(result.current.heldNotes).toContain(60);
    });

    it("reports a denied request", async () => {
        const midi = fakeMidi({ rejectWith: "denied" });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.status).toBe("denied");
    });

    it("reports an unsupported platform without ever requesting", async () => {
        const midi = fakeMidi({ supported: false });
        const request = vi.spyOn(midi, "request");
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        expect(result.current.support).toBe("unsupported");
        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.status).toBe("error");
        expect(request).not.toHaveBeenCalled();
    });

    it("silently resumes a previously granted connection on mount", async () => {
        const midi = fakeMidi({ permission: "granted" });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await waitFor(() => expect(result.current.status).toBe("ready"));
    });

    it("never prompts while permission is still undecided", async () => {
        const midi = fakeMidi({ permission: "prompt" });
        const request = vi.spyOn(midi, "request");
        renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {});
        expect(request).not.toHaveBeenCalled();
    });

    it("refreshes the device list on a hot-plug and closes the connection on unmount", async () => {
        const midi = fakeMidi({ inputs: [] });
        const { result, unmount } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(midi),
        });
        await act(async () => {
            result.current.requestAccess();
        });
        expect(result.current.devices).toEqual([]);

        midi.connection.inputs = () => [fakeMidiInput({ id: "in-2", name: "Plugged In" })];
        act(() => midi.connection.stateChange());
        expect(result.current.devices[0]?.name).toBe("Plugged In");

        unmount();
        expect(midi.connection.closed()).toBe(true);
    });

    it("releases a held note when its device disconnects, so nothing sticks on", async () => {
        const input = fakeMidiInput({ id: "in-1", name: "Test Piano" });
        const midi = fakeMidi({ inputs: [input] });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        // A key goes down and stays down — no note-off has arrived yet.
        act(() => input.emit([0x90, 60, 100]));
        expect(result.current.heldNotes).toContain(60);

        // The device is unplugged before the release, so it never sends the note-off.
        midi.connection.inputs = () => [];
        act(() => midi.connection.stateChange());
        // The held note is released on the disconnection rather than left stuck on.
        expect(result.current.heldNotes).not.toContain(60);
    });

    it("plays from the computer keyboard and shifts the octave", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z" })));
        expect(result.current.heldNotes).toContain(60);
        act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "z" })));
        expect(result.current.heldNotes).not.toContain(60);

        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" })));
        expect(result.current.octaveOffset).toBe(1);
    });

    it("releases keys still held when the window loses focus", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z" })));
        expect(result.current.heldNotes).toContain(60);
        // The keyup would otherwise be delivered to whatever window took focus,
        // leaving the note stuck; blur must clear it.
        act(() => window.dispatchEvent(new Event("blur")));
        expect(result.current.heldNotes).not.toContain(60);
    });

    it("releases an on-screen-keyboard note still held on blur", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
        // A pointer held on an on-screen key, then an OS app-switch, never delivers
        // pointerup; blur must release it too — not just computer-keyboard keys.
        act(() => result.current.pressKey(67));
        expect(result.current.heldNotes).toContain(67);
        act(() => window.dispatchEvent(new Event("blur")));
        expect(result.current.heldNotes).not.toContain(67);
    });

    it("plays from the on-screen keyboard bridge, notifies subscribers, and clears events", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
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
