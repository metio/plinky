// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadUserScores } from "../lib/catalog";
import { ScoreImport } from "./scoreImport";

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>Imported</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function open() {
    render(<ScoreImport existingIds={[]} onAdded={() => {}} />);
    fireEvent.click(screen.getByText("Import a score"));
}

describe("ScoreImport", () => {
    it("reveals the form when opened", () => {
        open();
        expect(screen.getByPlaceholderText(/Paste MusicXML/)).toBeTruthy();
    });

    it("rejects an empty submission", () => {
        const onAdded = vi.fn();
        render(<ScoreImport existingIds={[]} onAdded={onAdded} />);
        fireEvent.click(screen.getByText("Import a score"));
        fireEvent.click(screen.getByText("Add score"));
        expect(screen.getByText("Paste some MusicXML first.")).toBeTruthy();
        expect(onAdded).not.toHaveBeenCalled();
    });

    it("rejects input that is not playable MusicXML", () => {
        open();
        fireEvent.change(screen.getByPlaceholderText(/Paste MusicXML/), {
            target: { value: "<score-partwise></score-partwise>" },
        });
        fireEvent.click(screen.getByText("Add score"));
        expect(screen.getByText(/valid MusicXML/)).toBeTruthy();
    });

    it("saves a playable MusicXML score", () => {
        const onAdded = vi.fn();
        render(<ScoreImport existingIds={[]} onAdded={onAdded} />);
        fireEvent.click(screen.getByText("Import a score"));
        fireEvent.change(screen.getByPlaceholderText(/Paste MusicXML/), {
            target: { value: XML },
        });
        fireEvent.click(screen.getByText("Add score"));
        expect(onAdded).toHaveBeenCalled();
        expect(loadUserScores().map((score) => score.id)).toEqual(["imported"]);
    });

    it("closes again on cancel", () => {
        open();
        fireEvent.click(screen.getByText("Cancel"));
        expect(screen.queryByPlaceholderText(/Paste MusicXML/)).toBeNull();
        expect(screen.getByText("Import a score")).toBeTruthy();
    });
});
