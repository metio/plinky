// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LESSONS } from "../../core/theoryCourse";
import { demoMoments } from "../../core/theoryDemo";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import TheoryRoute from "./theory";

afterEach(cleanup);

// The address is the page's only state, so the tests need the route table that reads it:
// under a bare router `useParams` is empty and every address looks like the course index.
// These mirror app/routes.ts — the locale segment, then the page with and without a lesson.
function page(at = "/en/theory") {
    return (
        <MemoryRouter initialEntries={[at]}>
            <Routes>
                <Route path=":locale">
                    <Route path="theory" element={<TheoryRoute />} />
                    <Route path="theory/:lesson" element={<TheoryRoute />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("TheoryRoute", () => {
    it("opens on the first lesson, with every lesson named beside it", () => {
        renderWithServices(page());
        // One lesson on screen, not fourteen. Every lesson is prerendered at its own
        // address, so rendering them all here as well put each at two addresses and left
        // the course competing with itself.
        expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
        expect(screen.getByRole("heading", { name: m.theory_staff_title() })).toBeTruthy();
        const index = screen.getByRole("navigation", { name: m.theory_index_label() });
        expect(within(index).getAllByRole("link")).toHaveLength(LESSONS.length);
    });

    it("links each lesson to its own address rather than to an anchor", () => {
        renderWithServices(page());
        const index = screen.getByRole("navigation", { name: m.theory_index_label() });
        // An anchor can only move a reader down the page they are already on: it is not
        // somewhere a search engine can send anybody, which is the whole reason a lesson
        // has an address of its own.
        for (const link of within(index).getAllByRole("link")) {
            const href = link.getAttribute("href") ?? "";
            expect(href).not.toContain("#");
            expect(href).toContain("/theory/");
        }
    });

    it("opens the lesson the address names, and marks it in the index", () => {
        renderWithServices(page("/en/theory/octave"));
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(m.theory_octave_title());
        const index = screen.getByRole("navigation", { name: m.theory_index_label() });
        expect(
            within(index)
                .getByRole("link", { name: new RegExp(m.theory_octave_title()) })
                .getAttribute("aria-current"),
        ).toBe("page");
    });

    it("opens the first lesson when the address names one that does not exist", () => {
        // A stale link from an older build must not land on a blank page.
        renderWithServices(page("/en/theory/nonsense"));
        expect(screen.getByRole("heading", { name: m.theory_staff_title() })).toBeTruthy();
    });

    it("says the lesson's paragraph once, not twice", () => {
        // The page heading used to repeat the card's opening paragraph a few pixels above
        // it, which is only visible once a lesson has an address that shows both.
        renderWithServices(page("/en/theory/staff"));
        expect(screen.getAllByText(m.theory_staff_body())).toHaveLength(1);
    });

    it("gives every lesson a title, a paragraph and something to play", () => {
        for (const lesson of LESSONS) {
            renderWithServices(page(`/en/theory/${lesson.id}`));
            const hear = screen.queryAllByRole("button", { name: m.theory_hear_it() });
            const inTurn = screen.queryAllByRole("button", { name: m.theory_hear_them() });
            // A lesson that sounds one moment says "hear it"; one that unfolds says so,
            // because "hear it" over eight notes of a scale describes the wrong thing.
            const runs = demoMoments(lesson.demo).length > 1;
            expect(hear.length + inTurn.length).toBe(1);
            expect(inTurn).toHaveLength(runs ? 1 : 0);
            // Eight of the fourteen once carried no notation at all: the page drew one
            // only for the reading unit, so a lesson about a chord showed a keyboard and
            // nothing to read.
            expect(screen.getAllByRole("img", { name: /./ }).length).toBeGreaterThanOrEqual(1);
            cleanup();
        }
    });

    it("spells the key signature lesson out in the key it shows", () => {
        renderWithServices(page("/en/theory/signature"));
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

    it("closes with the two pages it points at", () => {
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
