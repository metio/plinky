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
    it("links to the project source on GitHub", () => {
        render(
            <MemoryRouter initialEntries={["/en"]}>
                <SiteFooter />
            </MemoryRouter>,
        );
        const source = screen.getByRole("link", { name: m.footer_source() });
        expect(source.getAttribute("href")).toContain("github.com/metio/plinky");
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
