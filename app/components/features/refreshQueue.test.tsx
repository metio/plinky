// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
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
        expect(screen.getByText(m.grades_all_fresh())).toBeTruthy();
        expect(screen.queryByRole("link", { name: m.review_start({ count: 0 }) })).toBeNull();
    });

    it("explains and offers the session even with nothing due, the only way to meet it", () => {
        mount([]);
        expect(screen.getByText(m.refresh_why())).toBeTruthy();
        expect(
            screen.getByRole("link", { name: m.review_explore() }).getAttribute("href"),
        ).toContain("/review");
    });

    it("offers the guided session and links each due piece", () => {
        mount([
            { id: "a", title: "Minuet" },
            { id: "b", title: "Ode to Joy" },
        ]);
        expect(screen.getByRole("link", { name: m.review_start({ count: 2 }) })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Minuet" }).getAttribute("href")).toContain(
            "/play/a",
        );
        expect(screen.getByRole("link", { name: "Ode to Joy" })).toBeTruthy();
    });

    it("keeps the why on screen when pieces are due, without doubling the entry points", () => {
        mount([{ id: "a", title: "Minuet" }]);
        expect(screen.getByText(m.refresh_why())).toBeTruthy();
        expect(screen.queryByRole("link", { name: m.review_explore() })).toBeNull();
    });
});
