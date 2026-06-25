// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { recordRun } from "../lib/lifetime";
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
});
