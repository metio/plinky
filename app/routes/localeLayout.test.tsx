// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isLocale } from "../paraglide/runtime.js";
import { renderWithServices } from "../testing/renderWithServices";
import LocaleLayout from "./localeLayout";

afterEach(cleanup);

// Shows where the router settled, so a redirect's destination is observable.
function Destination() {
    const { pathname, search, hash } = useLocation();
    return <div data-testid="dest">{`${pathname}${search}${hash}`}</div>;
}

function routerAt(initial: string) {
    return (
        <MemoryRouter initialEntries={[initial]}>
            <Routes>
                <Route path=":locale" element={<LocaleLayout />}>
                    <Route index element={<Destination />} />
                    <Route path="play/:scoreId" element={<Destination />} />
                    <Route path="music" element={<Destination />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("LocaleLayout", () => {
    it("redirects an unknown locale to the same page under a valid locale", async () => {
        renderWithServices(routerAt("/zz/play/abc"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        // The page is preserved (…/play/abc) but now under a real locale, not the "zz" typo.
        expect(dest).toMatch(/\/play\/abc\/$/);
        expect(dest.startsWith("/zz/")).toBe(false);
        expect(isLocale(dest.split("/")[1])).toBe(true);
    });

    it("carries the query and the fragment through the redirect", async () => {
        // A piece opened by a link that asks for one hand keeps the ask; a page opened at
        // a heading opens at the heading.
        renderWithServices(routerAt("/zz/play/abc?hands=left#bar-3"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        expect(dest).toMatch(/\/play\/abc\/\?hands=left#bar-3$/);
    });

    it("reads a lone segment as a page name, not as a mistyped locale", async () => {
        // "/music" is the case this serves: a page asked for with no language in front of
        // it. It is indistinguishable from a bare "/zz" typo, and answering the real
        // address is worth more than tidying away the typo — which now reaches the
        // not-found page rather than the home page.
        renderWithServices(routerAt("/music"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        expect(dest).toMatch(/\/music\/$/);
        expect(isLocale(dest.split("/")[1])).toBe(true);
    });

    it("leaves a known locale untouched", async () => {
        renderWithServices(routerAt("/en/play/abc"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        expect(dest).toBe("/en/play/abc");
    });
});
