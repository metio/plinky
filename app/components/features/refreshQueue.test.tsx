// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { RefreshQueue } from "./refreshQueue";

afterEach(cleanup);

const mount = (reviews: Array<{ id: string; title: string }>) =>
    render(
        <MemoryRouter>
            <RefreshQueue reviews={reviews} />
        </MemoryRouter>,
    );

describe("RefreshQueue", () => {
    it("praises an empty queue instead of showing a dead section", () => {
        mount([]);
        expect(screen.getByText(/All fresh/)).toBeTruthy();
        expect(screen.queryByRole("link", { name: /Review/ })).toBeNull();
    });

    it("offers the guided session and links each due piece", () => {
        mount([
            { id: "a", title: "Minuet" },
            { id: "b", title: "Ode to Joy" },
        ]);
        expect(screen.getByRole("link", { name: /Review 2 pieces/ })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Minuet" }).getAttribute("href")).toContain(
            "/play/a",
        );
        expect(screen.getByRole("link", { name: "Ode to Joy" })).toBeTruthy();
    });
});
