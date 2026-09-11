// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { overwriteGetLocale } from "../../paraglide/runtime.js";
import { WeekChart } from "./weekChart";

afterEach(() => {
    cleanup();
    overwriteGetLocale(() => "en");
});

describe("WeekChart", () => {
    it("scales each day's bar against the busiest day", () => {
        const { container } = render(
            <WeekChart
                days={[
                    { date: "2026-07-10", notes: 50 },
                    { date: "2026-07-11", notes: 100 },
                ]}
            />,
        );
        const bars = container.querySelectorAll<HTMLElement>(".bg-chart-peak");
        expect(bars[0]?.style.height).toBe("50%");
        expect(bars[1]?.style.height).toBe("100%");
        // Day labels drop the year.
        expect(screen.getByText("07-10")).toBeTruthy();
    });

    it("counts a day's notes in the reader's own singular and plural", () => {
        overwriteGetLocale(() => "de");
        const { container } = render(
            <WeekChart
                days={[
                    { date: "2026-07-10", notes: 1 },
                    { date: "2026-07-11", notes: 3 },
                ]}
            />,
        );
        const titles = [...container.querySelectorAll("[title]")].map((day) =>
            day.getAttribute("title"),
        );
        expect(titles).toEqual(["1 Note", "3 Noten"]);
    });

    it("survives an all-zero week without dividing by zero", () => {
        const { container } = render(<WeekChart days={[{ date: "2026-07-11", notes: 0 }]} />);
        expect(container.querySelector<HTMLElement>(".bg-chart-peak")?.style.height).toBe("0%");
    });
});
