// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeekChart } from "./weekChart";

afterEach(cleanup);

describe("WeekChart", () => {
    it("scales each day's bar against the busiest day", () => {
        const { container } = render(
            <WeekChart
                recent={[
                    { date: "2026-07-10", notes: 50 },
                    { date: "2026-07-11", notes: 100 },
                ]}
            />,
        );
        const bars = container.querySelectorAll<HTMLElement>(".bg-indigo-500");
        expect(bars[0]?.style.height).toBe("50%");
        expect(bars[1]?.style.height).toBe("100%");
        // Day labels drop the year.
        expect(screen.getByText("07-10")).toBeTruthy();
    });

    it("survives an all-zero week without dividing by zero", () => {
        const { container } = render(<WeekChart recent={[{ date: "2026-07-11", notes: 0 }]} />);
        expect(container.querySelector<HTMLElement>(".bg-indigo-500")?.style.height).toBe("0%");
    });
});
