// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityStats, Standing } from "./standing";
import { m } from "../../paraglide/messages.js";

afterEach(cleanup);

describe("Standing", () => {
    it("reads 'not graded yet' before the first grade is earned", () => {
        render(<Standing level={0} skill={0} competitive={false} />);
        expect(screen.getByText(m.grades_not_started())).toBeTruthy();
        expect(screen.queryByText(/Competitive/)).toBeNull();
    });

    it("shows the grade, the skill rating and the competitive badge", () => {
        render(<Standing level={3} skill={42} competitive />);
        expect(screen.getByText("Grade 3")).toBeTruthy();
        expect(screen.getByText(/42/)).toBeTruthy();
        expect(screen.getByText(/Competitive/)).toBeTruthy();
    });
});

describe("ActivityStats", () => {
    it("shows both lifetime tiles", () => {
        render(<ActivityStats daysPracticed={12} totalNotes={3456} />);
        expect(screen.getByText(m.progress_days_practiced())).toBeTruthy();
        expect(screen.getByText("12")).toBeTruthy();
        expect(screen.getByText("3456")).toBeTruthy();
    });
});
