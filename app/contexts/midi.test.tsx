// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KEY_MAP, rebindPedal } from "../../core/keyMap";
import type { PedalKind } from "../../core/pedals";
import { type FakeMidi, fakeMidi, fakeMidiInput } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { ON_SCREEN_DEVICE } from "../../core/midi";
import { ServicesProvider } from "./services";
import { MidiProvider, useMidiConnection, useMidiInput } from "./midi";

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

    it("releases only the dropped device's notes, leaving a second keyboard's chord held", async () => {
        const piano = fakeMidiInput({ id: "in-1", name: "Grand Piano" });
        const pad = fakeMidiInput({ id: "in-2", name: "Drum Pad" });
        const midi = fakeMidi({ inputs: [piano, pad] });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        // A chord is held on the piano; a single note is held on the pad.
        act(() => {
            piano.emit([0x90, 60, 100]);
            piano.emit([0x90, 64, 100]);
            pad.emit([0x90, 48, 100]);
        });
        expect(result.current.heldNotes).toEqual([48, 60, 64]);

        // Only the pad is unplugged. The piano is still connected and still holding.
        midi.connection.inputs = () => [piano];
        act(() => midi.connection.stateChange());
        // The pad's note lifts; the piano's chord must stay down, not be cut short.
        expect(result.current.heldNotes).toEqual([60, 64]);
    });

    it("does not cut a held MIDI note short when the window loses focus", async () => {
        const input = fakeMidiInput({ id: "in-1", name: "Grand Piano" });
        const midi = fakeMidi({ inputs: [input] });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        act(() => input.emit([0x90, 60, 100]));
        expect(result.current.heldNotes).toContain(60);
        // A MIDI device keeps sending its own note-off regardless of focus, so blur must
        // leave its held note alone — releasing it here would clip a note still down.
        act(() => window.dispatchEvent(new Event("blur")));
        expect(result.current.heldNotes).toContain(60);
    });

    it("releases the device's held notes on an all-notes-off control change", async () => {
        const input = fakeMidiInput({ id: "in-1", name: "Grand Piano" });
        const midi = fakeMidi({ inputs: [input] });
        const { result } = renderHook(() => useMidiConnection(), { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        act(() => {
            input.emit([0x90, 60, 100]);
            input.emit([0x90, 64, 100]);
        });
        expect(result.current.heldNotes).toEqual([60, 64]);
        // A panic / stop button sends CC123; after it the device sends no note-offs, so the
        // reset itself must release everything it was sounding.
        act(() => input.emit([0xb0, 123, 0]));
        expect(result.current.heldNotes).toEqual([]);
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

    it("ends a blur-released on-screen note on its own device, keeping its ring-out", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
        act(() => result.current.pressKey(67));
        act(() => window.dispatchEvent(new Event("blur")));
        // The release carries the on-screen device (its gentle hold-scale), not a
        // flattened precise "MIDI" that would clip the note's ring-out and recorded hold.
        expect(result.current.events[0]?.kind).toBe("noteoff");
        expect(result.current.events[0]?.device).toBe(ON_SCREEN_DEVICE);
    });

    it("releases a computer-keyboard note by physical key even if the glyph changed", () => {
        const { result } = renderHook(() => useMidiConnection(), {
            wrapper: wrapperWith(fakeMidi()),
        });
        // Press 'z' (KeyZ). A modifier engaged before release reports a different glyph,
        // but the same physical key must still release the note rather than strand it.
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ" })));
        expect(result.current.heldNotes).toContain(60);
        act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Ω", code: "KeyZ" })));
        expect(result.current.heldNotes).not.toContain(60);
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

    it("lifts a held MIDI pedal when its device disconnects", async () => {
        const input = fakeMidiInput({ id: "in-1", name: "Test Piano" });
        const midi = fakeMidi({ inputs: [input] });
        const pedals: [PedalKind, boolean][] = [];
        const useProbe = () => {
            const c = useMidiConnection();
            useMidiInput({ onPedal: (pedal, down) => pedals.push([pedal, down]) });
            return c;
        };
        const { result } = renderHook(useProbe, { wrapper: wrapperWith(midi) });
        await act(async () => {
            result.current.requestAccess();
        });
        act(() => input.emit([0xb0, 64, 127])); // sustain pressed, still down
        expect(pedals).toContainEqual(["sustain", true]);

        // Unplugged before the pedal lifts, so it never sends the release.
        midi.connection.inputs = () => [];
        act(() => midi.connection.stateChange());
        // The pedal is lifted on the disconnection rather than left latched down.
        expect(pedals).toContainEqual(["sustain", false]);
    });

    it("releases a pedal bound to a shifted-glyph key even with Shift held at release", () => {
        // Bind sustain to ";" — a shifted press reports ":" for event.key, so a key-based
        // lookup would miss the release. Tracking the physical code keeps press and release
        // paired.
        const store = memoryStore();
        store.set(
            "plinky:prefs",
            JSON.stringify({ keyMap: rebindPedal(DEFAULT_KEY_MAP, "sustain", ";") }),
        );
        const pedals: [PedalKind, boolean][] = [];
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ServicesProvider services={{ midi: fakeMidi(), store }}>
                <MidiProvider>{children}</MidiProvider>
            </ServicesProvider>
        );
        const useProbe = () => {
            const c = useMidiConnection();
            useMidiInput({ onPedal: (pedal, down) => pedals.push([pedal, down]) });
            return c;
        };
        renderHook(useProbe, { wrapper });

        act(() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: ";", code: "Semicolon" })),
        );
        // Shift went down after the pedal key, so the key-up reports the shifted glyph.
        act(() =>
            window.dispatchEvent(
                new KeyboardEvent("keyup", { key: ":", code: "Semicolon", shiftKey: true }),
            ),
        );
        expect(pedals).toEqual([
            ["sustain", true],
            ["sustain", false],
        ]);
    });
});
