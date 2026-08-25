// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { ScopeTile, scopeName } from "./scopeTile";

afterEach(cleanup);

const NOW = new Date("2026-08-19T10:00:00");
const SUMMARY = {
    totalNotes: 4820,
    daysPracticed: 18,
    bestDay: { date: "2026-08-12", notes: 640 },
};

describe("scopeName", () => {
    it("names a calendar period rather than describing a rolling one", () => {
        // Half the reason the scopes are calendar periods: a window with a name can head a
        // card, where "your last thirty days" can only ever be a description.
        expect(scopeName("month", NOW)).toBe("August 2026");
        expect(scopeName("year", NOW)).toBe("2026");
        expect(scopeName("all", NOW)).toBe(m.scope_all_name());
    });
});

describe("ScopeTile", () => {
    it("shares the figures it shows, whichever window is on", () => {
        render(<ScopeTile scope="month" summary={SUMMARY} now={NOW} />);
        const posted = screen
            .getAllByRole("link")
            .map((link) => decodeURIComponent(link.getAttribute("href") ?? ""));
        expect(posted.some((href) => href.includes("4,820") && href.includes("August 2026"))).toBe(
            true,
        );
    });

    it("names the window it is reporting on, so a figure is never unlabelled", () => {
        // The page's own bug: a lifetime fingerprint sat at the foot with no period on it
        // at all, and a month card at the other end, and nothing said which was which.
        render(<ScopeTile scope="all" summary={SUMMARY} now={NOW} />);
        expect(screen.getByText(m.scope_all_name())).toBeTruthy();
    });

    it("says nothing about a best day when there was none", () => {
        render(
            <ScopeTile
                scope="week"
                summary={{ totalNotes: 0, daysPracticed: 0, bestDay: null }}
                now={NOW}
            />,
        );
        expect(screen.queryByText(/Best day/)).toBeNull();
    });
});
