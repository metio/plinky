// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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
