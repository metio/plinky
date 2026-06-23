// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SongImport } from "./songImport";

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
        expect(screen.getByPlaceholderText(/Paste ABC/)).toBeTruthy();
    });

    it("rejects an empty submission", () => {
        const onAdded = vi.fn();
        render(<SongImport existingIds={[]} onAdded={onAdded} />);
        fireEvent.click(screen.getByText("Import a song"));
        fireEvent.click(screen.getByText("Add song"));
        expect(screen.getByText("Paste some ABC notation first.")).toBeTruthy();
        expect(onAdded).not.toHaveBeenCalled();
    });

    it("closes again on cancel", () => {
        open();
        fireEvent.click(screen.getByText("Cancel"));
        expect(screen.queryByPlaceholderText(/Paste ABC/)).toBeNull();
        expect(screen.getByText("Import a song")).toBeTruthy();
    });
});
