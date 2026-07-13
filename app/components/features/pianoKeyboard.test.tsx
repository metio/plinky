// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { PianoKeyboard } from "./pianoKeyboard";

afterEach(cleanup);

function renderKeyboard(props: {
    expected?: number[];
    from?: number;
    to?: number;
    wrong?: { note: number; seq: number } | null;
}) {
    return render(
        <MidiProvider>
            <PianoKeyboard {...props} />
        </MidiProvider>,
    );
}

describe("PianoKeyboard", () => {
    it("labels each key with its note name", () => {
        renderKeyboard({ from: 60, to: 62 });
        expect(screen.getByLabelText("C4")).toBeDefined();
        expect(screen.getByLabelText("C#4")).toBeDefined();
        expect(screen.getByLabelText("D4")).toBeDefined();
    });

    it("highlights the expected note", () => {
        renderKeyboard({ from: 60, to: 67, expected: [60] });
        expect(screen.getByLabelText("C4").className).toContain("bg-indigo-50 dark:bg-indigo-950");
        expect(screen.getByLabelText("D4").className).not.toContain(
            "bg-indigo-50 dark:bg-indigo-950",
        );
    });

    it("flashes a wrongly-played key red", async () => {
        renderKeyboard({ from: 60, to: 67, wrong: { note: 62, seq: 1 } });
        // The flash is set in an effect after mount, so wait for it.
        await waitFor(() => expect(screen.getByLabelText("D4").className).toContain("bg-red-200"));
    });

    it("keeps a leading black key inside the keyboard", () => {
        // A range starting on a black key has no white key before it, so its
        // center maps to a negative left unless it's clamped into the keyboard.
        renderKeyboard({ from: 61, to: 67 });
        const blackKey = screen.getByLabelText("C#4");
        const left = Number.parseFloat(blackKey.style.left);
        const width = Number.parseFloat(blackKey.style.width);
        expect(Number.isFinite(left)).toBe(true);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(100);
    });

    it("does not produce non-finite positions for a single black key", () => {
        renderKeyboard({ from: 61, to: 61 });
        const blackKey = screen.getByLabelText("C#4");
        expect(Number.isFinite(Number.parseFloat(blackKey.style.left))).toBe(true);
        expect(Number.isFinite(Number.parseFloat(blackKey.style.width))).toBe(true);
    });

    it("releases a held key when the keybed unmounts", () => {
        // A key held as the surface tears down (a run ending, leaving full screen) never
        // gets its pointer-up, so its note-off must be sent on unmount or the voice rings on.
        const events: { kind: string; note: number }[] = [];
        function Probe() {
            const { subscribe } = useMidiConnection();
            useEffect(
                () =>
                    subscribe({
                        onNoteOn: (e) => events.push({ kind: e.kind, note: e.note }),
                        onNoteOff: (e) => events.push({ kind: e.kind, note: e.note }),
                    }),
                [subscribe],
            );
            return null;
        }
        const view = render(
            <MidiProvider>
                <Probe />
                <PianoKeyboard from={60} to={62} />
            </MidiProvider>,
        );
        // Press and hold C4 — a pointer-down with no matching pointer-up.
        fireEvent.pointerDown(screen.getByLabelText("C4"));
        expect(events).toContainEqual({ kind: "noteon", note: 60 });

        // Unmount only the keybed; the funnel (and the Probe) stay to catch its parting note-off.
        view.rerender(
            <MidiProvider>
                <Probe />
            </MidiProvider>,
        );
        expect(events).toContainEqual({ kind: "noteoff", note: 60 });
    });
});
