// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { AdvancedOptions } from "./runSetup";

afterEach(cleanup);

// The run-setup panel carries 28 controls across five sections. For a true beginner that
// is not a set of choices, it is a wall — so at the starter level everything past the
// essentials folds behind one door, and comes back whole the moment they move on.

describe("AdvancedOptions", () => {
    it("shows everything outright once past the starter level", () => {
        render(
            <AdvancedOptions starter={false}>
                <p>keep going</p>
            </AdvancedOptions>,
        );

        expect(screen.getByText("keep going")).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.run_more_options() })).toBeNull();
    });

    it("folds them behind one door for a starter", () => {
        render(
            <AdvancedOptions starter={true}>
                <p>keep going</p>
            </AdvancedOptions>,
        );

        expect(screen.getByRole("button", { name: m.run_more_options() })).toBeTruthy();
    });

    it("hides nothing — one press opens all of it", () => {
        // The fold is not a feature gate. Everything a starter could want is one press
        // away, which is what makes folding it defensible in the first place.
        render(
            <AdvancedOptions starter={true}>
                <p>keep going</p>
            </AdvancedOptions>,
        );

        fireEvent.click(screen.getByRole("button", { name: m.run_more_options() }));

        expect(screen.getByText("keep going")).toBeTruthy();
    });
});
