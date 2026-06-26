// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { recordRun } from "../lib/lifetime";
import { markLearned, saveMastery } from "../lib/mastery";
import Progress from "./progress";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderProgress() {
    return render(
        <MemoryRouter>
            <Progress />
        </MemoryRouter>,
    );
}

describe("Progress", () => {
    it("shows the lifetime fingerprint once a run has been graded", async () => {
        recordRun({ accuracy: 95, timing: 90, flow: 88 });
        renderProgress();
        expect(await screen.findByText("Share your progress")).toBeTruthy();
        expect(
            screen.getByLabelText("Accuracy, timing and flow across your recent sessions"),
        ).toBeTruthy();
    });

    it("omits the fingerprint before any graded run", async () => {
        renderProgress();
        // The streak heading renders, but there is no fingerprint to share yet.
        await screen.findByText("Day streak");
        await waitFor(() => {
            expect(screen.queryByText("Share your progress")).toBeNull();
        });
    });

    it("lists scores whose review has come due, linking to practice", async () => {
        // Learned a month ago, so its spaced-repetition review is now overdue.
        const monthAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
        saveMastery("ode-to-joy", markLearned(null, monthAgo));
        renderProgress();
        await screen.findByText("Due for review");
        const link = await screen.findByText("Ode to Joy");
        expect(link.closest("a")?.getAttribute("href")).toContain("/play/ode-to-joy");
    });

    it("shows no review queue when nothing is due", async () => {
        renderProgress();
        await screen.findByText("Day streak");
        await waitFor(() => {
            expect(screen.queryByText("Due for review")).toBeNull();
        });
    });
});
