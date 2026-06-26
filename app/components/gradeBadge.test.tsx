// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { recordPractice } from "../lib/history";
import { markLearned, saveMastery } from "../lib/mastery";
import { GradeBadge } from "./gradeBadge";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

const mount = () =>
    render(
        <MemoryRouter>
            <GradeBadge />
        </MemoryRouter>,
    );

describe("GradeBadge", () => {
    it("stays hidden before any grade is earned", () => {
        mount();
        expect(screen.queryByRole("link", { name: /grade/i })).toBeNull();
    });

    it("shows the grade once earned", () => {
        // A practised day reaches grade 1; a learned scale reaches grade 2.
        recordPractice(8);
        saveMastery("scale-c-major", markLearned(null, Date.now()));
        mount();
        const link = screen.getByRole("link", { name: /grade/i });
        expect(link.textContent).toContain("2");
    });
});
