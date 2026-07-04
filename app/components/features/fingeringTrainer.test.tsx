// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FingeringDrill } from "./fingeringTrainer";

const playNote = vi.fn();
vi.mock("../../hooks/useSynth", () => ({ useSynth: () => ({ playNote }) }));

afterEach(() => {
    cleanup();
    localStorage.clear();
    playNote.mockClear();
});

// A two-note line (C4, D4) and a two-note chord (C4 + E4) to finger.
const LINE = [[60], [62]];
const CHORD = [[60, 64]];

describe("FingeringDrill", () => {
    it("scores the line only once every note has a finger", () => {
        render(<FingeringDrill positions={LINE} hand="right" />);
        expect((screen.getByText("Check finger positions") as HTMLButtonElement).disabled).toBe(
            true,
        );

        const one = screen.getByLabelText("Finger 1");
        fireEvent.click(one);
        fireEvent.click(one);
        expect((screen.getByText("Check finger positions") as HTMLButtonElement).disabled).toBe(
            false,
        );

        fireEvent.click(screen.getByText("Check finger positions"));
        expect(screen.getByText(/Smoothness:/)).toBeTruthy();
        expect(screen.queryByText("Check finger positions")).toBeNull();
    });

    it("accepts number keys as finger input", () => {
        render(<FingeringDrill positions={LINE} hand="right" />);
        const before = screen.getAllByText("3").length;
        fireEvent.keyDown(window, { key: "3" });
        expect(screen.getAllByText("3").length).toBe(before + 1);
    });

    it("sounds the chord once every note of it is fingered", () => {
        render(<FingeringDrill positions={CHORD} hand="right" />);
        expect(playNote).not.toHaveBeenCalled();
        const one = screen.getByLabelText("Finger 1");
        fireEvent.click(one); // first note of the chord
        fireEvent.click(one); // second note completes it → it sounds
        expect(playNote).toHaveBeenCalled();
    });

    it("marks a fingered note with a colour-blind-safe quality symbol", () => {
        render(<FingeringDrill positions={LINE} hand="right" />);
        fireEvent.click(screen.getByLabelText("Finger 1"));
        // The verdict carries a text label for assistive tech, not colour alone.
        expect(screen.getByLabelText(/Comfortable|Works|Awkward reach/)).toBeTruthy();
    });

    it("hides live feedback when hints are faded off", () => {
        render(<FingeringDrill positions={LINE} hand="right" hints={false} />);
        fireEvent.click(screen.getByLabelText("Finger 1"));
        expect(screen.queryByLabelText(/Comfortable|Works|Awkward reach/)).toBeNull();
    });

    it("says when there is nothing to finger", () => {
        render(<FingeringDrill positions={[]} hand="right" />);
        expect(screen.getByText(/Nothing to finger/)).toBeTruthy();
    });
});
