// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { testPrefsStore } from "../testing/stores";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradedMastery } from "../lib/gradeProgress";
import type { Mastery } from "../../core/mastery";

import { GradeBadge } from "./gradeBadge";

// Stub the catalogue join so the badge sees exactly the mastery we hand it; the grade
// it derives (currentGrade) stays the real implementation.
const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn<() => Promise<GradedMastery[]>>() }));
vi.mock("../lib/gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../lib/gradeProgress")>()),
    loadGradedMastery: loadMock,
}));

afterEach(() => {
    cleanup();
    loadMock.mockReset();
    localStorage.clear();
});

const fresh: Mastery = {
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 10,
    reviewAt: Date.now() + 86_400_000,
    updatedAt: 0,
};

const mastered = (grade: number, count: number): GradedMastery[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `g${grade}-${i}`,
        title: `g${grade}-${i}`,
        grade,
        cost: grade,
        mastery: fresh,
    }));

const mount = () =>
    render(
        <MemoryRouter>
            <GradeBadge />
        </MemoryRouter>,
    );

describe("GradeBadge", () => {
    it("shows a Grade 0 before any grade is earned, so /grades stays reachable", async () => {
        loadMock.mockResolvedValue(mastered(1, 4)); // short of Bronze
        mount();
        const link = await screen.findByRole("link", { name: /grade/i });
        expect(link.textContent).toContain("0");
    });

    it("shows the grade once a grade's Bronze is reached", async () => {
        loadMock.mockResolvedValue(mastered(1, 5)); // five mastered in grade 1 → Grade 1
        mount();
        const link = await screen.findByRole("link", { name: /grade/i });
        expect(link.textContent).toContain("1");
    });

    it("flags competitive mode in its label", async () => {
        testPrefsStore.save({ ...testPrefsStore.load(), decayMode: "competitive" });
        loadMock.mockResolvedValue(mastered(1, 5));
        mount();
        expect(await screen.findByRole("link", { name: /competitive/i })).toBeTruthy();
    });
});
