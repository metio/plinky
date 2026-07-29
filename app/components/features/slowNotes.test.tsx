// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { NoteStats } from "../../../core/noteStats";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { SlowNotes } from "./slowNotes";

afterEach(cleanup);

const mount = (stats: NoteStats) =>
    renderWithServices(<SlowNotes />, {
        store: memoryStore({ "plinky:notestats": JSON.stringify(stats) }),
    });

describe("SlowNotes", () => {
    it("says nothing until enough notes have been read enough times", () => {
        // An empty frame promising future insight is worse than no frame.
        const { container } = mount({});

        expect(container.firstChild).toBeNull();
    });

    it("stays quiet when every note is still short of the threshold", () => {
        const { container } = mount({ "60": { plays: 2, wrongs: 0, totalMs: 4000 } });

        expect(container.firstChild).toBeNull();
    });

    it("lists the slowest notes by name, longest first", () => {
        mount({
            "60": { plays: 10, wrongs: 0, totalMs: 3000 },
            "62": { plays: 10, wrongs: 0, totalMs: 12000 },
            "64": { plays: 10, wrongs: 0, totalMs: 8000 },
        });

        const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
        // D4 at 1.2s, then E4 at 0.8s, then C4 at 0.3s.
        expect(rows[0]).toContain("D4");
        expect(rows[1]).toContain("E4");
        expect(rows[2]).toContain("C4");
    });

    it("shows each note's reading time in seconds", () => {
        mount({
            "60": { plays: 10, wrongs: 0, totalMs: 3000 },
            "62": { plays: 10, wrongs: 0, totalMs: 12000 },
            "64": { plays: 10, wrongs: 0, totalMs: 8000 },
        });

        expect(screen.getByText(m.slow_notes_seconds({ seconds: "1.2" }))).toBeTruthy();
        expect(screen.getByText(m.slow_notes_seconds({ seconds: "0.3" }))).toBeTruthy();
    });

    it("gives the typical time these are slow against", () => {
        mount({
            "60": { plays: 10, wrongs: 0, totalMs: 3000 },
            "62": { plays: 10, wrongs: 0, totalMs: 12000 },
            "64": { plays: 10, wrongs: 0, totalMs: 8000 },
        });

        // The median of 0.3, 0.8 and 1.2 is 0.8.
        expect(screen.getByText(m.slow_notes_intro({ typical: "0.8" }))).toBeTruthy();
    });

    it("reads a corrupt record as nothing rather than crashing the page", () => {
        const { container } = renderWithServices(<SlowNotes />, {
            store: memoryStore({ "plinky:notestats": "{{ not json" }),
        });

        expect(container.firstChild).toBeNull();
    });
});
