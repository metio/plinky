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
        });
        render(<AchievementGallery achievements={achievements} />);

        expect(screen.getByRole("heading", { name: m.achievements_heading() })).toBeTruthy();
        // Every badge renders — earned or not — so the goals are visible.
        expect(screen.getAllByRole("listitem")).toHaveLength(achievements.length);
        // Earned and locked states are announced, not only colour-coded.
        expect(screen.getAllByText(m.achievement_earned())).toHaveLength(5);
        expect(screen.getAllByText(m.achievement_locked())).toHaveLength(achievements.length - 5);
        // The dimmed badge carries the visual mute; the earned one doesn't.
        const firstS = screen.getByText(m.achievement_first_s()).closest("li");
        expect(firstS?.className).not.toContain("grayscale");
        const flawless = screen.getByText(m.achievement_flawless()).closest("li");
        expect(flawless?.className).toContain("grayscale");
    });
});
