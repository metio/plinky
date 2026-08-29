// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { WayIn } from "./scoreGrade";

afterEach(cleanup);

describe("WayIn", () => {
    it("offers the easiest reduction, not the mildest one", () => {
        // Three ways in, and the reader is asking whether they can play this at all — so
        // the number that answers is the lowest, not the one that takes least out.
        render(<WayIn reach={{ thinned: 5, outlined: 3, melody: 1 }} />);
        expect(screen.getByText(m.way_in_melody({ grade: 1 }))).toBeTruthy();
    });

    it("names the reduction that reaches the grade, so the reader knows what it costs", () => {
        render(<WayIn reach={{ outlined: 3 }} />);
        expect(screen.getByText(m.way_in_outlined({ grade: 3 }))).toBeTruthy();
    });

    it("says nothing at all about a piece with nothing to take out", () => {
        const { container } = render(<WayIn reach={{}} />);
        expect(container.textContent).toBe("");
    });

    it("says nothing when the catalogue has not measured the piece", () => {
        const { container } = render(<WayIn />);
        expect(container.textContent).toBe("");
    });
});
