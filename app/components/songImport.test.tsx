// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadUserSongs } from "../lib/catalog";
import { SongImport } from "./songImport";

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>Imported</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function open() {
    render(<SongImport existingIds={[]} onAdded={() => {}} />);
    fireEvent.click(screen.getByText("Import a song"));
}

describe("SongImport", () => {
    it("reveals the form when opened", () => {
        open();
        expect(screen.getByPlaceholderText(/Paste MusicXML/)).toBeTruthy();
    });

    it("rejects an empty submission", () => {
        const onAdded = vi.fn();
        render(<SongImport existingIds={[]} onAdded={onAdded} />);
        fireEvent.click(screen.getByText("Import a song"));
        fireEvent.click(screen.getByText("Add song"));
        expect(screen.getByText("Paste some MusicXML first.")).toBeTruthy();
        expect(onAdded).not.toHaveBeenCalled();
    });

    it("rejects input that is not playable MusicXML", () => {
        open();
        fireEvent.change(screen.getByPlaceholderText(/Paste MusicXML/), {
            target: { value: "<score-partwise></score-partwise>" },
        });
        fireEvent.click(screen.getByText("Add song"));
        expect(screen.getByText(/valid MusicXML/)).toBeTruthy();
    });

    it("saves a playable MusicXML song", () => {
        const onAdded = vi.fn();
        render(<SongImport existingIds={[]} onAdded={onAdded} />);
        fireEvent.click(screen.getByText("Import a song"));
        fireEvent.change(screen.getByPlaceholderText(/Paste MusicXML/), {
            target: { value: XML },
        });
        fireEvent.click(screen.getByText("Add song"));
        expect(onAdded).toHaveBeenCalled();
        expect(loadUserSongs().map((song) => song.id)).toEqual(["imported"]);
    });

    it("closes again on cancel", () => {
        open();
        fireEvent.click(screen.getByText("Cancel"));
        expect(screen.queryByPlaceholderText(/Paste MusicXML/)).toBeNull();
        expect(screen.getByText("Import a song")).toBeTruthy();
    });
});
