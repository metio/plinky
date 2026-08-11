// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "../../core/theoryCourse";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import TheoryRoute from "./theory";

afterEach(cleanup);

describe("TheoryRoute", () => {
    it("renders every lesson under a unit heading", () => {
        renderWithServices(<TheoryRoute />);
        expect(screen.getAllByRole("listitem")).toHaveLength(LESSONS.length);
        expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(UNITS.length);
    });

    it("gives every lesson a title, a paragraph and something to play", () => {
        renderWithServices(<TheoryRoute />);
        expect(screen.getByRole("heading", { name: m.theory_staff_title() })).toBeTruthy();
        expect(screen.getByText(m.theory_staff_body())).toBeTruthy();
        const hear = screen.getAllByRole("button", { name: m.theory_hear_it() });
        const both = screen.getAllByRole("button", { name: m.theory_hear_both() });
        expect(hear.length + both.length).toBe(LESSONS.length);
    });

    it("offers a side-by-side listen wherever the lesson is about a difference", () => {
        renderWithServices(<TheoryRoute />);
        const comparisons = LESSONS.filter((lesson) => lesson.demo.kind === "compare").length;
        expect(screen.getAllByRole("button", { name: m.theory_hear_both() })).toHaveLength(
            comparisons,
        );
    });

    it("spells the key signature lesson out in the key it shows", () => {
        renderWithServices(<TheoryRoute />);
        // G major: one sharp, F♯.
        expect(screen.getByText(m.theory_signature_reads({ key: "G", notes: "F♯" }))).toBeTruthy();
    });

    it("plays without falling over when a lesson is asked to sound", () => {
        renderWithServices(<TheoryRoute />);
        for (const button of screen.getAllByRole("button")) {
            fireEvent.click(button);
        }
        expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });

    it("counts the lessons it actually has", () => {
        renderWithServices(<TheoryRoute />);
        expect(screen.getByText(m.theory_outro({ count: LESSONS.length }))).toBeTruthy();
    });
});
