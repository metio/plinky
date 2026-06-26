// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { FingeringTrainer } from "./fingeringTrainer";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

const mount = () =>
    render(
        <MemoryRouter>
            <FingeringTrainer />
        </MemoryRouter>,
    );

describe("FingeringTrainer", () => {
    it("scores the line only once every note has a finger", () => {
        mount();
        const check = screen.getByText("Check fingering") as HTMLButtonElement;
        expect(check.disabled).toBe(true);

        // Assigning a finger advances to the next note; chords add notes, so press
        // well past the line length — extra presses just re-set the last note.
        const one = screen.getByLabelText("Finger 1");
        for (let i = 0; i < 30; i++) {
            fireEvent.click(one);
        }
        expect((screen.getByText("Check fingering") as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(screen.getByText("Check fingering"));
        // The result replaces the picker with a smoothness score and a fresh-line action.
        expect(screen.getByText(/Smoothness:/)).toBeTruthy();
        expect(screen.getByText("New line")).toBeTruthy();
        expect(screen.queryByText("Check fingering")).toBeNull();
    });

    it("switches to a left-hand drill in the bass", () => {
        mount();
        const left = screen.getByRole("button", { name: "Left" });
        fireEvent.click(left);
        expect(left.getAttribute("aria-pressed")).toBe("true");
        // The left-hand line reads below middle C — note names in octave 2 or 3.
        expect(screen.getAllByText(/^[A-G][23]$/).length).toBeGreaterThan(0);
    });

    it("accepts number keys as finger input", () => {
        mount();
        // "3" appears once as the picker button; a keypress assigns it to a note too.
        const before = screen.getAllByText("3").length;
        fireEvent.keyDown(window, { key: "3" });
        expect(screen.getAllByText("3").length).toBe(before + 1);
    });
});
