// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { localizeHref } from "../../paraglide/runtime.js";
import { localizedHref } from "./href";
import { BottomNav } from "./navBar";

afterEach(cleanup);

// isActive compares the router pathname against the localized href, so the router must
// sit at the localized path. The raw paraglide form is used on purpose: it is the bare
// path a visitor can arrive on before the host redirects, and the bar must still light.
const at = (path: string) =>
    render(
        <MemoryRouter initialEntries={[localizeHref(path)]}>
            <BottomNav />
        </MemoryRouter>,
    );

// The active link is the one marked aria-current="page".
const current = () =>
    screen.getAllByRole("link").find((link) => link.getAttribute("aria-current") === "page")
        ?.textContent;

describe("BottomNav active section", () => {
    it("lights Home only on the exact root path", () => {
        at("/");
        expect(current()).toMatch(/home/i);
    });

    it("lights the section that owns the current path", () => {
        at("/library");
        expect(current()).toMatch(/library/i);
    });

    it("keeps a section lit while on one of its sub-pages", () => {
        at("/library/some-piece");
        expect(current()).toMatch(/library/i);
    });

    it("does not light Home on a sub-page of another section", () => {
        at("/you");
        expect(current()).not.toMatch(/home/i);
    });

    it("lights the section on the trailing-slash path the links carry", () => {
        at("/library/");
        expect(current()).toMatch(/library/i);
    });

    it("does not light a section whose name only prefixes the current path", () => {
        at("/librarything");
        expect(current()).toBeUndefined();
    });
});

describe("BottomNav hrefs", () => {
    it("point at the trailing-slash form the prerendered page is served under", () => {
        at("/");
        const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
        expect(hrefs).toContain(localizedHref("/library"));
        for (const href of hrefs) {
            expect(href).toMatch(/\/$/);
        }
    });
});
