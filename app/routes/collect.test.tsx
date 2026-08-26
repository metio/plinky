// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeAssignment } from "../../core/assignment";
import { buildReport, encodeReport } from "../../core/assignmentReport";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import Collect from "./collect";

afterEach(cleanup);

const assignment = makeAssignment({
    id: "first-steps",
    name: "First steps",
    items: [{ id: "twinkle" }, { id: "ode-to-joy" }],
});

const codeFor = (who: string, scores: Record<string, number>, at = 1) =>
    encodeReport(buildReport(assignment, (id) => scores[id] ?? null, who, at));

function paste(text: string) {
    fireEvent.change(screen.getByLabelText(m.collect_paste()), { target: { value: text } });
}

describe("Collect", () => {
    it("shows no table until something readable arrives", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        expect(screen.queryByRole("table")).toBeNull();
    });

    it("reads a pasted class into a table", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        paste(`${codeFor("Ada", { twinkle: 91 })}\n${codeFor("Grace", { twinkle: 70 })}`);

        expect(screen.getByRole("table")).toBeTruthy();
        expect(screen.getByRole("rowheader", { name: "Ada" })).toBeTruthy();
        expect(screen.getByRole("rowheader", { name: "Grace" })).toBeTruthy();
    });

    it("says so when the paste holds nothing readable", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        paste("thanks, here you go!");

        expect(screen.getByRole("status").textContent).toBe(m.collect_nothing());
    });

    it("leaves a piece nobody attempted blank rather than failing it", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        paste(codeFor("Ada", { twinkle: 91 }));

        // Two pieces, one played: the untouched one reads as a dash.
        expect(screen.getByText("A (91)")).toBeTruthy();
        expect(screen.getAllByText("–")).toHaveLength(1);
    });

    it("names a piece the device knows and falls back to its id", () => {
        const store = memoryStore({
            "plinky:scores": JSON.stringify([
                { id: "twinkle", title: "Twinkle", xml: "<score-partwise/>" },
            ]),
        });
        renderWithServices(<Collect />, { store });

        paste(codeFor("Ada", { twinkle: 91 }));

        expect(screen.getByRole("columnheader", { name: "Twinkle" })).toBeTruthy();
        // A teacher's library need not match the student's; an unknown id shows as
        // itself rather than as an anonymous column.
        expect(screen.getByRole("columnheader", { name: "ode-to-joy" })).toBeTruthy();
    });

    it("keeps nothing once the paste is cleared", () => {
        renderWithServices(<Collect />, { store: memoryStore() });
        paste(codeFor("Ada", { twinkle: 91 }));

        paste("");

        expect(screen.queryByRole("table")).toBeNull();
    });
});

describe("Collect with more than one assignment pasted", () => {
    const piano = makeAssignment({
        id: "piano-week-3",
        origin: "origin-piano",
        name: "Piano, week 3",
        items: [{ id: "twinkle" }, { id: "ode-to-joy" }],
    });
    const theory = makeAssignment({
        id: "theory-week-3",
        origin: "origin-theory",
        name: "Theory, week 3",
        items: [{ id: "intervals" }],
    });
    const report = (
        assignment: Parameters<typeof buildReport>[0],
        who: string,
        scores: Record<string, number>,
    ) => encodeReport(buildReport(assignment, (id) => scores[id] ?? null, who, 1));

    const both = () =>
        paste(
            [
                report(piano, "Ada", { twinkle: 91, "ode-to-joy": 70 }),
                report(theory, "Ada", { intervals: 80 }),
                report(piano, "Grace", { twinkle: 60 }),
            ].join("\n"),
        );

    it("gives each assignment its own table under its own name", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        both();

        expect(screen.getAllByRole("table")).toHaveLength(2);
        expect(screen.getByRole("heading", { name: "Piano, week 3" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Theory, week 3" })).toBeTruthy();
    });

    it("does not put one assignment's pieces in another's columns", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        both();

        // Read as one table, Ada's theory row showed a dash under Twinkle and Ode to
        // Joy — a piece she was never asked for, presented as one she skipped.
        const [pianoTable, theoryTable] = screen.getAllByRole("table");
        expect(pianoTable?.textContent).toContain("twinkle");
        expect(theoryTable?.textContent).not.toContain("twinkle");
        expect(theoryTable?.textContent).toContain("intervals");
    });

    it("counts every report across the assignments", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        both();

        expect(screen.getByText(m.collect_found({ count: 3 }))).toBeTruthy();
    });

    it("offers a download for each assignment separately", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        both();

        expect(screen.getAllByRole("button", { name: m.collect_csv() })).toHaveLength(2);
    });

    it("names each table by its assignment", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        both();

        // Two tables announced only as "table" are two tables nobody can tell apart.
        expect(screen.getByRole("table", { name: "Piano, week 3" })).toBeTruthy();
        expect(screen.getByRole("table", { name: "Theory, week 3" })).toBeTruthy();
    });

    it("heads a set whose name did not travel with the codes", () => {
        renderWithServices(<Collect />, { store: memoryStore() });

        const nameless = makeAssignment({ id: "x", origin: "o", name: " ", items: [{ id: "a" }] });
        // makeAssignment substitutes its own placeholder for an empty name, so the
        // wire case is a code carrying no name at all.
        paste(encodeReport({ ...buildReport(nameless, () => 1, "Ada", 1), assignmentName: "" }));

        expect(screen.getByRole("heading", { name: m.collect_untitled() })).toBeTruthy();
    });
});
