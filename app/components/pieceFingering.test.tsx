// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadSongFingering } from "../lib/savedFingering";
import { PieceFingering } from "./pieceFingering";

const measure = (n: number, step: string) =>
    `<measure number="${n}"><note><pitch><step>${step}</step><octave>4</octave></pitch><staff>1</staff></note></measure>`;

const XML = `<score-partwise><part id="P1">${measure(1, "C")}${measure(2, "D")}${measure(3, "E")}${measure(4, "F")}</part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("PieceFingering", () => {
    it("slides a two-bar window through the piece", () => {
        render(<PieceFingering id="t" xml={XML} />);
        // Right hand by default; the first window is bars 1–2 of the four-bar piece.
        expect(screen.getByText("Bars 1–2 of 4")).toBeTruthy();
        expect(screen.getByText("C4")).toBeTruthy();
        expect(screen.getByText("D4")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Next bars" }));
        expect(screen.getByText("Bars 2–3 of 4")).toBeTruthy();
        expect(screen.getByText("E4")).toBeTruthy();
    });

    it("saves a chosen finger per score position and offers to clear it", () => {
        const { unmount } = render(<PieceFingering id="t" xml={XML} />);
        // Finger the first note (bar 0, position 0, note 0 of the right hand).
        fireEvent.click(screen.getByLabelText("Finger 2"));
        expect(loadSongFingering("t")["right:0:0:0"]).toBe(2);

        // Re-opening the piece pre-fills the saved finger and shows a clear control.
        unmount();
        render(<PieceFingering id="t" xml={XML} />);
        expect(screen.getByText(/saved for this piece/)).toBeTruthy();
        fireEvent.click(screen.getByText("Clear it"));
        expect(loadSongFingering("t")).toEqual({});
    });
});
