// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { collectAchievements } from "../../../core/achievements";
import { m } from "../../paraglide/messages.js";
import { AchievementGallery } from "./achievementGallery";

afterEach(cleanup);

describe("AchievementGallery", () => {
    it("shows the whole shelf, with unearned badges dimmed as visible goals", () => {
        const achievements = collectAchievements({
            reachedGrade: 2,
            hasS: true,
            flawless: false,
            stars: new Set(["bronze"]),
            daysPracticed: 12,
            totalNotes: 500,
            earTrained: true,
            earFlawless: false,
            earMastered: false,
        });
        render(<AchievementGallery achievements={achievements} />);

        expect(screen.getByRole("heading", { name: m.achievements_heading() })).toBeTruthy();
        // Every badge renders — earned or not — so the goals are visible.
        expect(screen.getAllByRole("listitem")).toHaveLength(achievements.length);
        // Earned and locked states are announced, not only colour-coded.
        // grade-1, grade-2, first-s, star-bronze, days-10, and the ear "first" badge.
        expect(screen.getAllByText(m.achievement_earned())).toHaveLength(6);
        expect(screen.getAllByText(m.achievement_locked())).toHaveLength(achievements.length - 6);
        // The visual mute sits on the decorative emoji only — dimming the label
        // would sink it below the contrast floor the axe gate enforces.
        const firstS = screen.getByText(m.achievement_first_s()).closest("li");
        expect(firstS?.innerHTML).not.toContain("grayscale");
        const flawless = screen.getByText(m.achievement_flawless()).closest("li");
        expect(flawless?.querySelector('[aria-hidden="true"]')?.className).toContain("grayscale");
        expect(flawless?.querySelector('[aria-hidden="true"]')?.className).toContain("opacity-45");
    });
});
