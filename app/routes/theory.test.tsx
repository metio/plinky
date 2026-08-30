// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "../../core/theoryCourse";
import { demoMoments } from "../../core/theoryDemo";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import TheoryRoute from "./theory";

afterEach(cleanup);

// The closing line links out to two other pages, so the route needs a router under it.
const page = () => (
    <MemoryRouter initialEntries={["/en/theory"]}>
        <TheoryRoute />
    </MemoryRouter>
);

describe("TheoryRoute", () => {
    it("renders every lesson under a unit heading", () => {
        renderWithServices(page());
        // Counted by the heading each lesson card carries rather than by list items on the
        // page: the index down the side is a list of the same lessons, so counting every
        // <li> counts each one twice and would read as fourteen extra lessons.
        expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(LESSONS.length);
        expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(UNITS.length);
    });

    it("offers an index that names every lesson, for coming back to one", () => {
        renderWithServices(page());
        const index = screen.getByRole("navigation", { name: m.theory_index_label() });
        expect(within(index).getAllByRole("link")).toHaveLength(LESSONS.length);
        // Anchors, so the course still reads in order and the index only re-enters it.
        expect(
            within(index)
                .getAllByRole("link")
                .every((link) => link.getAttribute("href")?.includes("#")),
        ).toBe(true);
    });

    it("gives every lesson a title, a paragraph and something to play", () => {
        renderWithServices(page());
        expect(screen.getByRole("heading", { name: m.theory_staff_title() })).toBeTruthy();
        expect(screen.getByText(m.theory_staff_body())).toBeTruthy();
        const hear = screen.getAllByRole("button", { name: m.theory_hear_it() });
        const inTurn = screen.getAllByRole("button", { name: m.theory_hear_them() });
        expect(hear.length + inTurn.length).toBe(LESSONS.length);
    });

    it("says so when a lesson has several things to hear one after another", () => {
        renderWithServices(page());
        // A lesson that sounds one moment says "hear it"; one that unfolds says so, because
        // "hear it" over eight notes of a scale describes the wrong thing.
        const runs = LESSONS.filter((lesson) => demoMoments(lesson.demo).length > 1).length;
        expect(screen.getAllByRole("button", { name: m.theory_hear_them() })).toHaveLength(runs);
        expect(runs).toBeGreaterThan(0);
    });

    it("draws a written example for every lesson, not only the reading ones", () => {
        renderWithServices(page());
        // Eight of the fourteen carried no notation at all: the page drew one only for the
        // reading unit, so a lesson about a chord showed a keyboard and nothing to read.
        expect(screen.getAllByRole("img", { name: /./ }).length).toBeGreaterThanOrEqual(
            LESSONS.length,
        );
    });

    it("spells the key signature lesson out in the key it shows", () => {
        renderWithServices(page());
        // G major: one sharp, F♯.
        expect(screen.getByText(m.theory_signature_reads({ key: "G", notes: "F♯" }))).toBeTruthy();
    });

    it("plays without falling over when a lesson is asked to sound", () => {
        renderWithServices(page());
        for (const button of screen.getAllByRole("button")) {
            fireEvent.click(button);
        }
        expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });

    it("counts the lessons it actually has", () => {
        renderWithServices(page());
        // The closing line links two pages out of the middle of a sentence, so it is
        // rendered in pieces and matched by what it says rather than as one text node.
        expect(
            screen.getByRole("link", { name: m.glossary_title() }).getAttribute("href"),
        ).toContain("/glossary");
        expect(screen.getByRole("link", { name: m.tools_title() }).getAttribute("href")).toContain(
            "/tools",
        );
        expect(screen.queryByText(/\[\[/)).toBeNull();
    });
});
