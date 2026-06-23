// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { exercises } from "../lib/exercises";
import Home from "./home";

afterEach(cleanup);

function renderHome() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("lists every exercise by title", () => {
        renderHome();
        for (const exercise of exercises) {
            expect(screen.getByText(exercise.title)).toBeTruthy();
        }
    });

    it("links each exercise to all three practice modes", () => {
        renderHome();
        const hrefs = [...document.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
        const first = exercises[0].id;
        expect(hrefs).toContain(`/practice/${first}`);
        expect(hrefs).toContain(`/time-trial/${first}`);
        expect(hrefs).toContain(`/rhythm/${first}`);
    });
});
