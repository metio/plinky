// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { RecapCard } from "./recapCard";

afterEach(cleanup);

describe("RecapCard", () => {
    it("names the month and shows the notes and days", () => {
        render(
            <RecapCard
                recap={{
                    month: "2026-07",
                    totalNotes: 4820,
                    daysPracticed: 18,
                    bestDay: { date: "2026-07-12", notes: 640 },
                }}
            />,
        );
        // The month name comes from Intl in the active (English) locale.
        expect(screen.getByText(m.recap_heading({ month: "July 2026" }))).toBeTruthy();
        expect(screen.getByText(m.progress_notes_played())).toBeTruthy();
        expect(screen.getByText(m.recap_best_day({ count: 640 }))).toBeTruthy();
    });

    it("omits the best-day line when there was no standout day", () => {
        render(
            <RecapCard
                recap={{ month: "2026-03", totalNotes: 120, daysPracticed: 2, bestDay: null }}
            />,
        );
        expect(screen.queryByText(/Best day/)).toBeNull();
    });
});
