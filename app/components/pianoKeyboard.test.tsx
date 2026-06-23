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
});
