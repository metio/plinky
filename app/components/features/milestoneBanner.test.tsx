// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MilestoneProvider, useMilestoneChannel } from "../../contexts/milestone";
import { m } from "../../paraglide/messages.js";
import { MilestoneBanner, MilestoneBannerHost } from "./milestoneBanner";

afterEach(cleanup);

// A control that publishes a fixed grade-up moment, so the host can be driven exactly the
// way a finished run drives it — through the channel, not through props.
function PublishGradeUp() {
    const { publish } = useMilestoneChannel();
    return (
        <button type="button" onClick={() => publish({ kind: "grade-up", grade: 3, skill: 1200 })}>
            publish
        </button>
    );
}

describe("MilestoneBanner", () => {
    it("announces a grade-up and dismisses on the ✕", () => {
        const onDismiss = vi.fn();
        render(
            <MilestoneBanner
                milestone={{ kind: "grade-up", grade: 3, skill: 1200 }}
                onDismiss={onDismiss}
            />,
        );
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.getByText(m.milestone_grade_heading({ level: 3 }))).toBeTruthy();

        fireEvent.click(screen.getByLabelText(m.action_dismiss()));
        expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("names the song in a flawless-run moment", () => {
        render(
            <MilestoneBanner
                milestone={{ kind: "flawless", songTitle: "Minuet in G" }}
                onDismiss={() => {}}
            />,
        );
        expect(
            screen.getByText(m.milestone_flawless_heading({ title: "Minuet in G" })),
        ).toBeTruthy();
    });
});

describe("MilestoneBannerHost", () => {
    it("shows nothing until a run publishes, then celebrates and clears on dismiss", () => {
        render(
            <MilestoneProvider>
                <PublishGradeUp />
                <MilestoneBannerHost />
            </MilestoneProvider>,
        );
        expect(screen.queryByRole("status")).toBeNull();

        fireEvent.click(screen.getByText("publish"));
        expect(screen.getByText(m.milestone_grade_heading({ level: 3 }))).toBeTruthy();

        fireEvent.click(screen.getByLabelText(m.action_dismiss()));
        expect(screen.queryByRole("status")).toBeNull();
    });
});
