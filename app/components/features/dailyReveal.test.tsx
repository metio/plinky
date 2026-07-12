// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { DailyReveal } from "./dailyReveal";

afterEach(cleanup);

describe("DailyReveal", () => {
    it("hides the unplayed challenge behind the present until opened", () => {
        render(
            <DailyReveal alreadyOpen={false}>
                <p>the score</p>
            </DailyReveal>,
        );
        expect(screen.queryByText("the score")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: m.daily_reveal() }));
        expect(screen.getByText("the score")).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.daily_reveal() })).toBeNull();
    });

    it("skips the ceremony once the daily has already been played", () => {
        render(
            <DailyReveal alreadyOpen>
                <p>the result</p>
            </DailyReveal>,
        );
        expect(screen.getByText("the result")).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.daily_reveal() })).toBeNull();
    });
});
