// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UpdateBanner } from "./updateBanner";

afterEach(cleanup);

describe("UpdateBanner", () => {
    it("says nothing while updates are working", () => {
        // A waiting build is taken at the next boundary without asking, so there is
        // nothing to announce — the banner exists only for the opposite case.
        render(<UpdateBanner />);
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("warns when updates can't be installed on this device", () => {
        render(<UpdateBanner updateBroken={true} />);

        expect(screen.getByRole("status").textContent).toContain("Updates can’t be installed");
        // Nothing to press: there is no build waiting, which is the whole problem.
        expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    });

    it("dismisses on ✕ and stays dismissed for this page load", () => {
        const { rerender } = render(<UpdateBanner updateBroken={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByRole("status")).toBeNull();

        rerender(<UpdateBanner updateBroken={true} />);
        expect(screen.queryByRole("status")).toBeNull();
    });
});
