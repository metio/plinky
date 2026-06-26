// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { todayKey } from "../lib/daily";
import { PRACTICE_EVENT } from "../lib/history";
import { StreakBadge } from "./streakBadge";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

const mount = () =>
    render(
        <MemoryRouter>
            <StreakBadge />
        </MemoryRouter>,
    );

const badge = () => screen.getByRole("link", { name: /streak/i });

describe("StreakBadge", () => {
    it("lights up once today has been practiced", () => {
        localStorage.setItem("plinky:history", JSON.stringify({ [todayKey(new Date())]: 12 }));
        mount();
        const link = badge();
        expect(link.textContent).toContain("1");
        expect(link.className).toContain("text-gray-900");
        expect(link.querySelector("span")?.className).not.toContain("grayscale");
    });

    it("stays greyed until the day's first run", () => {
        mount();
        const link = badge();
        expect(link.textContent).toContain("0");
        expect(link.className).toContain("text-gray-500");
        expect(link.querySelector("span")?.className).toContain("grayscale");
    });

    it("refreshes live when a run is recorded", () => {
        mount();
        expect(badge().className).toContain("text-gray-500");
        localStorage.setItem("plinky:history", JSON.stringify({ [todayKey(new Date())]: 5 }));
        fireEvent(window, new Event(PRACTICE_EVENT));
        const link = badge();
        expect(link.textContent).toContain("1");
        expect(link.className).toContain("text-gray-900");
    });
});
