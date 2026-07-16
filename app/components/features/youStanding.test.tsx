// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityStats, YouStanding } from "./youStanding";
import { m } from "../../paraglide/messages.js";

afterEach(cleanup);

describe("YouStanding", () => {
    it("reads 'not graded yet' before the first grade is earned", () => {
        render(<YouStanding level={0} skill={0} competitive={false} />);
        expect(screen.getByText("Not graded yet")).toBeTruthy();
        expect(screen.queryByText(/Competitive/)).toBeNull();
    });

    it("shows the grade, the skill rating and the competitive badge", () => {
        render(<YouStanding level={3} skill={42} competitive />);
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
