// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
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
    it("lights Home on the home page", () => {
        // Home is in the bottom bar and only there. On a wide screen the mark is always in
        // view and leads home; on a phone the header scrolls away with the page, so
        // somebody deep in a long score had no way back but to scroll all of it.
        at("/");
        expect(current()).toBe(m.nav_home());
    });

    it("matches Home exactly, so a section does not light it too", () => {
        // Every other destination lights on its sub-pages as well, which for "/" would
        // mean lighting on every page in the app.
        at("/music");
        expect(current()).not.toBe(m.nav_home());
    });

    it("lights the section that owns the current path", () => {
        at("/music");
        expect(current()).toBe(m.music_title());
    });

    it("keeps a section lit while on one of its sub-pages", () => {
        at("/music/some-piece");
        expect(current()).toBe(m.music_title());
    });

    it("lights nothing on a page no section owns", () => {
        at("/stats");
        expect(current()).toBeUndefined();
    });

    it("lights the section on the trailing-slash path the links carry", () => {
        at("/music/");
        expect(current()).toBe(m.music_title());
    });

    it("does not light a section whose name only prefixes the current path", () => {
        at("/musicology");
        expect(current()).toBeUndefined();
    });
});

describe("BottomNav hrefs", () => {
    it("point at the trailing-slash form the prerendered page is served under", () => {
        at("/");
        const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
        expect(hrefs).toContain(localizedHref("/music"));
        expect(hrefs).toContain(localizedHref("/learn"));
        for (const href of hrefs) {
            expect(href).toMatch(/\/$/);
        }
    });
});
