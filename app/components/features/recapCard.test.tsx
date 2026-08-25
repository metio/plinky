// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

    it("shares the month's practice, not just its name", () => {
        // The bug this pins: the share button posted the heading alone — "Your July 2026 in
        // music" — which is the one line on the card that carries no practice in it. What
        // went out named a month and said nothing about it.
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
        const posted = screen
            .getAllByRole("link")
            .map((link) => decodeURIComponent(link.getAttribute("href") ?? ""));
        // Every platform link carries the same sentence, so any one of them proves it.
        expect(posted.some((href) => href.includes("4,820") && href.includes("18"))).toBe(true);
    });

    it("offers the platforms the rest of the app shares through", () => {
        // Rather than a button of its own that only ever copied. A month worth showing
        // somebody is shown the same way a grade is.
        render(
            <RecapCard
                recap={{ month: "2026-07", totalNotes: 4820, daysPracticed: 18, bestDay: null }}
            />,
        );
        for (const platform of ["X", "Bluesky", "WhatsApp"]) {
            expect(screen.getByRole("link", { name: m.share_on({ platform }) })).toBeTruthy();
        }
        expect(screen.getByRole("button", { name: m.share_copy() })).toBeTruthy();
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
