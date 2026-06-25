// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { PianoKeyboard } from "./pianoKeyboard";

afterEach(cleanup);

function renderKeyboard(props: { expected?: number[]; from?: number; to?: number }) {
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
});
