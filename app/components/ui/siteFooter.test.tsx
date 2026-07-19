// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { SiteFooter } from "./siteFooter";

afterEach(cleanup);

describe("SiteFooter", () => {
    it("routes the heart to the About page", () => {
        render(
            <MemoryRouter initialEntries={["/en"]}>
                <SiteFooter />
            </MemoryRouter>,
        );
        const heart = screen.getByRole("link", { name: m.nav_about() });
        expect(heart.getAttribute("href")).toContain("/about");
    });

    it("links to the Impressum and Datenschutz pages the law requires", () => {
        render(
            <MemoryRouter initialEntries={["/en"]}>
                <SiteFooter />
            </MemoryRouter>,
        );
        expect(screen.getByRole("link", { name: "Impressum" }).getAttribute("href")).toContain(
            "/impressum",
        );
        expect(screen.getByRole("link", { name: "Datenschutz" }).getAttribute("href")).toContain(
            "/datenschutz",
        );
    });
});
