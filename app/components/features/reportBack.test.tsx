// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeAssignment } from "../../../core/assignment";
import { decodeReport, NOT_PLAYED } from "../../../core/assignmentReport";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { ReportBack } from "./reportBack";

afterEach(cleanup);

const assignment = makeAssignment({
    id: "first-steps",
    name: "First steps",
    items: [{ id: "twinkle" }, { id: "ode-to-joy" }],
});

function mount(seed: Record<string, string> = {}) {
    renderWithServices(<ReportBack assignment={assignment} />, { store: memoryStore(seed) });
    // The panel is folded away until asked for.
    fireEvent.click(screen.getByText(m.report_back()));
}

const codeBox = () => screen.getByLabelText(m.report_code()) as HTMLTextAreaElement;

describe("ReportBack", () => {
    it("will not make a code without a name to put on it", () => {
        mount();

        expect(screen.getByRole("button", { name: m.report_make() }).hasAttribute("disabled")).toBe(
            true,
        );
    });

    it("reports what the device scored, and what it never played", () => {
        mount({
            "plinky:mastery:twinkle": JSON.stringify({ bestScore: 88, learned: true }),
        });

        fireEvent.change(screen.getByLabelText(m.report_who()), { target: { value: "Ada" } });
        fireEvent.click(screen.getByRole("button", { name: m.report_make() }));

        const report = decodeReport(codeBox().value);
        expect(report?.who).toBe("Ada");
        expect(report?.items).toEqual([
            { id: "twinkle", score: 88 },
            { id: "ode-to-joy", score: NOT_PLAYED },
        ]);
    });

    it("drops a stale code when the name changes", () => {
        mount();
        fireEvent.change(screen.getByLabelText(m.report_who()), { target: { value: "Ada" } });
        fireEvent.click(screen.getByRole("button", { name: m.report_make() }));

        fireEvent.change(screen.getByLabelText(m.report_who()), { target: { value: "Grace" } });

        // A code naming Ada must not sit under a field reading Grace.
        expect(screen.queryByLabelText(m.report_code())).toBeNull();
    });

    it("says plainly that a code is not proof", () => {
        mount();
        fireEvent.change(screen.getByLabelText(m.report_who()), { target: { value: "Ada" } });
        fireEvent.click(screen.getByRole("button", { name: m.report_make() }));

        expect(screen.getByText(m.report_not_proof())).toBeTruthy();
    });
});
