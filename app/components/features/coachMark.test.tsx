// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoachMark } from "./coachMark";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("CoachMark", () => {
    it("shows the first time and stays dismissed afterwards", () => {
        const { unmount } = render(<CoachMark id="modes">try ear mode</CoachMark>);
        expect(screen.getByText("try ear mode")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Dismiss"));
        expect(screen.queryByText("try ear mode")).toBeNull();

        // Re-mounting (a later visit) doesn't bring it back.
        unmount();
        render(<CoachMark id="modes">try ear mode</CoachMark>);
        expect(screen.queryByText("try ear mode")).toBeNull();
    });
});
